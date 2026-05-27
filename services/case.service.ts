import { query, transaction } from '@/lib/db';
import { truncateVarchar255 } from '@/lib/db/varchar-limits';
import { joinDocumentFileNamesForTramite } from '@/lib/validations/case-document-files';
import {
  appCaseStatusToEstadoId,
  dbEstadoTramiteToApp,
  TRAMITE_ESTADO_ID,
} from '@/lib/db/estado-tramite-map';
import {
  AdminCasesListResponse,
  Case,
  CaseReturnHistoryEntry,
  CaseStatus,
  CaseWithCreator,
  CreateCaseDTO,
  UpdateCaseDTO,
} from '@/types/case.types';
import { UserRole } from '@/types/user.types';
import { PoolClient } from 'pg';
import { NotificationService } from './notification.service';
import { FileService } from './file.service';
import {
  resolveRoutingForCreatorArea,
  finalAreaMaySeeCaseInReviewList,
  buildOrderedReviewAreaIds,
  reconcileTramitesRoutingWithEnrutamiento,
} from '@/services/routing.service';
import { ForbiddenError } from '@/lib/utils/errors';
import type { RoutingFlowKind } from '@/types/routing.types';

async function isAreaSupervisor(userId: string, areaId: number): Promise<boolean> {
  const r = await query<{ supervisor_id: string | null }>(
    `SELECT supervisor_id FROM configuracion_areas WHERE id = $1 LIMIT 1`,
    [areaId]
  );
  const sid = r.rows[0]?.supervisor_id;
  if (sid == null) return true;
  return sid === userId;
}

export class CaseService {
  /**
   * Obtiene todos los trámites con información del creador
   * Filtrado según el rol del usuario
   * @param assignedOnly - Si es true, solo devuelve trámites asignados al área del usuario
   */
  static async getAllCases(userId: string, role: UserRole, areaId: number | undefined, assignedOnly: boolean = false): Promise<CaseWithCreator[]> {
    await reconcileTramitesRoutingWithEnrutamiento();

    const result = await query<Record<string, unknown>>(
      'SELECT * FROM obtener_tramites_usuario($1, $2, $3, $4)',
      [userId, role, areaId ?? null, assignedOnly]
    );

    let mapped = result.rows.map(this.mapCaseFromDb);
    mapped = await this.enrichWithJunctionAreas(mapped);
    mapped = await this.attachReviewedAreasForCases(mapped);

    const mandatoryRes = await query<{ area_id: number }>(
      `SELECT id AS area_id FROM configuracion_areas WHERE obligatorio = true AND activo = true`
    );
    const mandatoryAreas = mandatoryRes.rows.map((r) => r.area_id);

    const finalRes = await query<{ area_id: number }>(
      `SELECT id AS area_id FROM configuracion_areas WHERE activo = true AND es_paso_final = true ORDER BY orden ASC`
    );
    const finalAreas = finalRes.rows.map((r) => r.area_id);

    const orderRes = await query<{ area_id: number; es_paso_final: boolean }>(
      `SELECT id AS area_id, es_paso_final FROM configuracion_areas WHERE activo = true ORDER BY orden ASC`
    );
    const orderRows = orderRes.rows;

    if (assignedOnly && role === 'AREA_USER' && areaId && finalAreas.includes(areaId)) {
      mapped = mapped.filter((c) =>
        finalAreaMaySeeCaseInReviewList({
          routingFlow: (c.routingFlow as RoutingFlowKind | null) ?? null,
          supervisionCompleted: c.supervisionCompleted === true,
          viewerAreaId: areaId,
          orderedAreaIds: buildOrderedReviewAreaIds({
            routingFlow: (c.routingFlow as RoutingFlowKind | null) ?? null,
            supervisionCompleted: c.supervisionCompleted === true,
            supervisionAreaId: c.supervisionAreaId ?? null,
            reviewAreaIds: (c.reviewAreaIds ?? []) as number[],
            mandatoryAreaIds: mandatoryAreas,
            orderRows,
          }),
          approvedReviewAreas: (c.approvedReviewAreaIds ?? []) as number[],
        })
      );
    }

    if (assignedOnly && role === 'AREA_USER' && areaId) {
      if (await isAreaSupervisor(userId, areaId)) {
        const pendingRes = await query(
          `SELECT t.*,
                  u.nombre || ' ' || u.apellido AS nombre_creador,
                  u.email AS email_creador,
                  (SELECT COUNT(*)::text FROM archivos WHERE tramite_id = t.id AND eliminado = false) AS file_count,
                  (SELECT COUNT(*)::text FROM comentarios WHERE tramite_id = t.id) AS comment_count
           FROM tramites t
           JOIN usuarios u ON u.id = t.creado_por
           WHERE t.tipo_flujo = 'SUPERVISION_CHAIN'
             AND t.supervision_completada = false
             AND t.area_supervision_id = $1
             AND t.estado_id = ${TRAMITE_ESTADO_ID.SUBMITTED}`,
          [areaId]
        );
        const seen = new Set(mapped.map((m) => m.id));
        const extras = pendingRes.rows.map(this.mapCaseFromDb);
        const enriched = await this.enrichWithJunctionAreas(extras.filter((e) => !seen.has(e.id)));
        for (const row of enriched) {
          if (seen.has(row.id)) continue;
          mapped.push(row);
          seen.add(row.id);
        }
      }
    }

    return mapped;
  }

  /**
   * Listado paginado para administración (búsqueda y filtro por estado), sin la lógica de visibilidad por rol.
   */
  static async listCasesForAdmin(params: {
    page: number;
    limit: number;
    q?: string;
    status?: CaseStatus | null;
  }): Promise<AdminCasesListResponse> {
    await reconcileTramitesRoutingWithEnrutamiento();

    const page = Math.max(1, Math.floor(params.page));
    const limit = Math.min(100, Math.max(1, Math.floor(params.limit)));
    const offset = (page - 1) * limit;
    const qRaw = String(params.q ?? '').trim();
    const q = qRaw.length > 200 ? qRaw.slice(0, 200) : qRaw;
    const status = params.status ?? null;

    const conditions: string[] = ['TRUE'];
    const whereValues: unknown[] = [];
    let idx = 1;

    if (q.length > 0) {
      conditions.push(
        `(t.titulo ILIKE $${idx} OR t.numero_tramite ILIKE $${idx} OR COALESCE(t.codigo_odoo::text, '') ILIKE $${idx} OR COALESCE(t.cliente_proveedor, '') ILIKE $${idx})`
      );
      whereValues.push(`%${q}%`);
      idx++;
    }
    if (status != null) {
      conditions.push(`t.estado_id = $${idx}`);
      whereValues.push(appCaseStatusToEstadoId(status));
      idx++;
    }

    const whereSql = conditions.join(' AND ');

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tramites t WHERE ${whereSql}`,
      whereValues
    );
    const total = parseInt(countRes.rows[0]?.count ?? '0', 10) || 0;

    const limParam = idx;
    const offParam = idx + 1;
    const listValues = [...whereValues, limit, offset];
    const listSql = `
      SELECT t.*,
             u.nombre || ' ' || u.apellido AS nombre_creador,
             u.email AS email_creador,
             (SELECT COUNT(*)::text FROM archivos WHERE tramite_id = t.id AND eliminado = false) AS file_count,
             (SELECT COUNT(*)::text FROM comentarios WHERE tramite_id = t.id) AS comment_count
      FROM tramites t
      JOIN usuarios u ON u.id = t.creado_por
      WHERE ${whereSql}
      ORDER BY t.creado_en DESC
      LIMIT $${limParam} OFFSET $${offParam}
    `;

    const result = await query(listSql, listValues);
    const items = result.rows.map((row) => this.mapCaseFromDb(row));
    return { items, total, page, limit };
  }

  /**
   * Impide que un usuario de área con paso final abra el detalle antes de turno (p. ej. Director antes que Legal).
   */
  static async assertFinalStepAreaUserMayViewCaseInReview(
    caseData: CaseWithCreator,
    viewerAreaId: number | null | undefined,
    viewerRole: UserRole,
    viewerUserId: string
  ): Promise<void> {
    if (viewerRole === 'ADMIN' || viewerUserId === caseData.createdBy) return;
    if (viewerRole !== 'AREA_USER' || viewerAreaId == null) return;
    const st = caseData.status;
    if (st !== 'SUBMITTED' && st !== 'IN_REVIEW') return;

    const finalRes = await query<{ area_id: number }>(
      `SELECT id AS area_id FROM configuracion_areas WHERE activo = true AND es_paso_final = true`
    );
    const finalIds = finalRes.rows.map((r) => r.area_id);
    if (!finalIds.includes(viewerAreaId)) return;

    const mandatoryRes = await query<{ area_id: number }>(
      `SELECT id AS area_id FROM configuracion_areas WHERE obligatorio = true AND activo = true`
    );
    const mandatoryAreas = mandatoryRes.rows.map((r) => r.area_id);
    const orderRes = await query<{ area_id: number; es_paso_final: boolean }>(
      `SELECT id AS area_id, es_paso_final FROM configuracion_areas WHERE activo = true ORDER BY orden ASC`
    );

    const ok = finalAreaMaySeeCaseInReviewList({
      routingFlow: (caseData.routingFlow as RoutingFlowKind | null) ?? null,
      supervisionCompleted: caseData.supervisionCompleted === true,
      viewerAreaId,
      orderedAreaIds: buildOrderedReviewAreaIds({
        routingFlow: (caseData.routingFlow as RoutingFlowKind | null) ?? null,
        supervisionCompleted: caseData.supervisionCompleted === true,
        supervisionAreaId: caseData.supervisionAreaId ?? null,
        reviewAreaIds: (caseData.reviewAreaIds ?? []) as number[],
        mandatoryAreaIds: mandatoryAreas,
        orderRows: orderRes.rows,
      }),
      approvedReviewAreas: (caseData.approvedReviewAreaIds ?? []) as number[],
    });
    if (!ok) {
      throw new ForbiddenError(
        'Aún no corresponde el acceso de su área a este trámite en el circuito de revisión.'
      );
    }
  }

  /**
   * Obtiene un trámite por ID
   */
  static async getCaseById(id: string): Promise<CaseWithCreator | null> {
    await reconcileTramitesRoutingWithEnrutamiento();

    const result = await query<CaseWithCreator>(
      `SELECT t.*,
              u.nombre || ' ' || u.apellido AS nombre_creador,
              u.email AS email_creador,
              (SELECT COUNT(*)::text FROM archivos WHERE tramite_id = t.id AND eliminado = false) AS file_count,
              (SELECT COUNT(*)::text FROM comentarios WHERE tramite_id = t.id) AS comment_count,
              NULLIF(trim(COALESCE(sup.nombre,'') || ' ' || COALESCE(sup.apellido,'')), '') AS supervisor_supervision_nombre
       FROM tramites t
       JOIN usuarios u ON u.id = t.creado_por
       LEFT JOIN configuracion_areas ca_sup ON ca_sup.id = t.area_supervision_id
       LEFT JOIN usuarios sup ON sup.id = ca_sup.supervisor_id
       WHERE t.id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;
    const c = this.mapCaseFromDb(result.rows[0] as unknown as Record<string, unknown>);
    const [enriched] = await this.enrichWithJunctionAreas([c]);
    const [withReviewers] = await this.attachReviewedAreasForCases([enriched]);
    return withReviewers;
  }

  /**
   * Crea un nuevo trámite
   */
  static async createCase(data: CreateCaseDTO, userId: string): Promise<Case> {
    return transaction(async (client: PoolClient) => {
      const uRow = await client.query<{ area_id: number | null }>(
        `SELECT area_id FROM usuarios WHERE id = $1`,
        [userId]
      );
      const creatorAreaId = uRow.rows[0]?.area_id ?? undefined;
      const policy = await resolveRoutingForCreatorArea(creatorAreaId);

      const supervisionCompleted = policy.flowKind === 'DIRECT_LEGAL';

      const caseResult = await client.query<Case>(
        `INSERT INTO tramites (
          titulo, descripcion, fecha_limite, creado_por, estado_id,
          nombre_asesor, nombre_archivo_documento, codigo_odoo, cliente_proveedor,
          tipo_documento, url_sharepoint, fecha_solicitud, fecha_entrega_requerida,
          justificacion_urgencia, tipo_firma, tipo_plantilla, observaciones,
          area_creador_id, tipo_flujo, area_supervision_id, supervision_completada,
          aplica_monto, valor_monto
         )
         VALUES ($1, $2, $3, $4, ${TRAMITE_ESTADO_ID.SUBMITTED},
                 $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                 $17, $18, $19, $20, $21, $22)
         RETURNING *`,
        [
          truncateVarchar255(data.title) ?? data.title,
          data.description,
          data.dueDate,
          userId,
          truncateVarchar255(data.advisorName),
          data.documentFileName
            ? joinDocumentFileNamesForTramite(
                data.documentFileName.split(',').map((s) => s.trim()).filter(Boolean)
              )
            : undefined,
          data.odooCode,
          truncateVarchar255(data.clientProvider),
          data.documentType,
          data.sharepointUrl,
          data.requestDate,
          data.requiredDeliveryDate,
          data.urgencyJustification,
          data.signatureType,
          data.templateType,
          data.observations,
          creatorAreaId ?? null,
          policy.flowKind,
          policy.supervisionAreaId ?? null,
          supervisionCompleted,
          data.amountApplies === true,
          data.amountApplies === true && data.amountValue != null ? data.amountValue : null,
        ]
      );

      const newCase = caseResult.rows[0];
      return this.mapCaseFromDb(newCase as unknown as Record<string, unknown>);
    });
  }

  /**
   * Actualiza un trámite
   */
  static async updateCase(id: string, data: UpdateCaseDTO): Promise<Case | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (data.title !== undefined) {
      fields.push(`titulo = $${paramCount++}`);
      values.push(data.title);
    }
    if (data.description !== undefined) {
      fields.push(`descripcion = $${paramCount++}`);
      values.push(data.description);
    }
    if (data.status !== undefined) {
      fields.push(`estado_id = $${paramCount++}`);
      values.push(appCaseStatusToEstadoId(data.status));
    }
    if (data.dueDate !== undefined) {
      fields.push(`fecha_limite = $${paramCount++}`);
      values.push(data.dueDate);
    }
    if (data.advisorName !== undefined) {
      fields.push(`nombre_asesor = $${paramCount++}`);
      values.push(data.advisorName);
    }
    if (data.documentFileName !== undefined) {
      fields.push(`nombre_archivo_documento = $${paramCount++}`);
      values.push(data.documentFileName);
    }
    if (data.odooCode !== undefined) {
      fields.push(`codigo_odoo = $${paramCount++}`);
      values.push(data.odooCode);
    }
    if (data.clientProvider !== undefined) {
      fields.push(`cliente_proveedor = $${paramCount++}`);
      values.push(data.clientProvider);
    }
    if (data.documentType !== undefined) {
      fields.push(`tipo_documento = $${paramCount++}`);
      values.push(data.documentType);
    }
    if (data.sharepointUrl !== undefined) {
      fields.push(`url_sharepoint = $${paramCount++}`);
      values.push(data.sharepointUrl);
    }
    if (data.requestDate !== undefined) {
      fields.push(`fecha_solicitud = $${paramCount++}`);
      values.push(data.requestDate);
    }
    if (data.requiredDeliveryDate !== undefined) {
      fields.push(`fecha_entrega_requerida = $${paramCount++}`);
      values.push(data.requiredDeliveryDate);
    }
    if (data.urgencyJustification !== undefined) {
      fields.push(`justificacion_urgencia = $${paramCount++}`);
      values.push(data.urgencyJustification);
    }
    if (data.signatureType !== undefined) {
      fields.push(`tipo_firma = $${paramCount++}`);
      values.push(data.signatureType);
    }
    if (data.templateType !== undefined) {
      fields.push(`tipo_plantilla = $${paramCount++}`);
      values.push(data.templateType);
    }
    if (data.observations !== undefined) {
      fields.push(`observaciones = $${paramCount++}`);
      values.push(data.observations);
    }

    if (fields.length === 0) return null;

    values.push(id);
    const queryText = `
      UPDATE tramites
      SET ${fields.join(', ')}, actualizado_en = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query<Case>(queryText, values);
    if (result.rows.length === 0) return null;

    return this.mapCaseFromDb(result.rows[0] as unknown as Record<string, unknown>);
  }

  /**
   * Envía un trámite para revisión
   */
  static async submitCase(caseId: string): Promise<void> {
    let caseInfo:
      | { numero_tramite: string; titulo: string; creado_por: string; nombre_creador?: string }
      | undefined;
    let notifyAreaIds: number[] = [];

    await transaction(async (client: PoolClient) => {
      const caseResult = await client.query(
        `SELECT t.numero_tramite, t.titulo, t.creado_por,
                u.nombre || ' ' || u.apellido as nombre_creador
         FROM tramites t
         JOIN usuarios u ON t.creado_por = u.id
         WHERE t.id = $1`,
        [caseId]
      );
      caseInfo = caseResult.rows[0] as {
        numero_tramite: string;
        titulo: string;
        creado_por: string;
        nombre_creador?: string;
      };

      const reviewRes = await client.query<{ area_id: number }>(
        `SELECT area_id FROM tramite_areas_revision WHERE tramite_id = $1`,
        [caseId]
      );
      notifyAreaIds = reviewRes.rows.map((r) => r.area_id);

      await client.query(
        `DELETE FROM tramite_areas_aprobadas WHERE tramite_id = $1`,
        [caseId]
      );

      await client.query(
        `UPDATE tramites
         SET estado_id = $2, area_actual_id = NULL
         WHERE id = $1`,
        [caseId, TRAMITE_ESTADO_ID.IN_REVIEW]
      );
    });

    const dgCheck = await query<{ has: boolean }>(
      `SELECT (
        EXISTS (
          SELECT 1 FROM tramite_areas_revision tar
          JOIN configuracion_areas ca ON ca.id = tar.area_id
          WHERE tar.tramite_id = $1 AND ca.puede_completar_tramite = true
        )
        OR EXISTS (
          SELECT 1 FROM configuracion_areas
          WHERE puede_completar_tramite = true AND obligatorio = true AND activo = true
        )
      ) AS has`,
      [caseId]
    );
    if (dgCheck.rows[0]?.has) {
      await FileService.ensureDirectorSigningRowsForCase(caseId);
    }

    if (caseInfo && notifyAreaIds.length) {
      for (const areaId of notifyAreaIds) {
        await NotificationService.notifyAreaNewCase(
          caseId,
          caseInfo.numero_tramite,
          caseInfo.titulo,
          areaId,
          caseInfo.nombre_creador ?? ''
        );
      }
    }
  }

  /**
   * Enriquece trámites con áreas de revisión y aprobadas desde tablas de unión
   */
  private static async enrichWithJunctionAreas(cases: CaseWithCreator[]): Promise<CaseWithCreator[]> {
    if (cases.length === 0) return cases;
    const ids = cases.map((c) => c.id);

    const [reviewRes, approvedRes, mandatoryRes] = await Promise.all([
      query<{ tramite_id: string; area_id: number }>(
        `SELECT tramite_id::text, area_id FROM tramite_areas_revision WHERE tramite_id = ANY($1::uuid[])`,
        [ids]
      ),
      query<{ tramite_id: string; area_id: number }>(
        `SELECT tramite_id::text, area_id FROM tramite_areas_aprobadas WHERE tramite_id = ANY($1::uuid[])`,
        [ids]
      ),
      query<{ area_id: number }>(
        `SELECT id AS area_id FROM configuracion_areas WHERE obligatorio = true AND activo = true`
      ),
    ]);
    const mandatoryIds = mandatoryRes.rows.map((r) => r.area_id);

    const reviewMap = new Map<string, number[]>();
    for (const row of reviewRes.rows) {
      if (!reviewMap.has(row.tramite_id)) reviewMap.set(row.tramite_id, []);
      reviewMap.get(row.tramite_id)!.push(row.area_id);
    }

    const approvedMap = new Map<string, number[]>();
    for (const row of approvedRes.rows) {
      if (!approvedMap.has(row.tramite_id)) approvedMap.set(row.tramite_id, []);
      approvedMap.get(row.tramite_id)!.push(row.area_id);
    }

    return cases.map((c) => {
      const reviewIds = reviewMap.get(c.id) ?? [];
      const supPending =
        c.routingFlow === 'SUPERVISION_CHAIN' && c.supervisionCompleted !== true;
      const commentEligibleAreaIds = supPending
        ? []
        : [...new Set([...reviewIds, ...mandatoryIds])];
      return {
        ...c,
        reviewAreaIds: reviewIds,
        approvedReviewAreaIds: approvedMap.get(c.id) ?? [],
        commentEligibleAreaIds,
      };
    });
  }

  /**
   * Áreas que ya aprobaron, etiquetas legibles para listas.
   */
  private static async attachReviewedAreasForCases(cases: CaseWithCreator[]): Promise<CaseWithCreator[]> {
    if (cases.length === 0) return cases;
    const ids = cases.map((c) => c.id);
    const result = await query<{
      tramite_id: string;
      label: string;
    }>(
      `SELECT taa.tramite_id::text,
              ca.nombre_area AS label,
              ca.orden
       FROM tramite_areas_aprobadas taa
       JOIN configuracion_areas ca ON ca.id = taa.area_id
       WHERE taa.tramite_id = ANY($1::uuid[])
       ORDER BY taa.tramite_id, ca.orden NULLS LAST`,
      [ids]
    );
    const byCase = new Map<string, string[]>();
    for (const row of result.rows) {
      const id = row.tramite_id;
      const label = String(row.label ?? '').trim();
      if (!label) continue;
      if (!byCase.has(id)) byCase.set(id, []);
      const arr = byCase.get(id)!;
      if (!arr.includes(label)) arr.push(label);
    }
    return cases.map((c) => ({
      ...c,
      reviewedByAreaLabels: byCase.get(c.id) ?? [],
    }));
  }

  private static parseReturnHistory(raw: unknown): CaseReturnHistoryEntry[] | undefined {
    if (raw == null) return undefined;
    if (!Array.isArray(raw)) return undefined;
    const out: CaseReturnHistoryEntry[] = [];
    for (const e of raw) {
      if (!e || typeof e !== 'object') continue;
      const o = e as Record<string, unknown>;
      const at = o.at;
      const areaRaw = o.areaId ?? o.area;
      const areaNum = typeof areaRaw === 'number' ? areaRaw : Number(areaRaw);
      out.push({
        areaId: Number.isFinite(areaNum) ? areaNum : 0,
        reason: String(o.reason ?? ''),
        allowFileUpdate: Boolean(o.allowFileUpdate),
        at: at instanceof Date ? at.toISOString() : String(at ?? ''),
      });
    }
    return out.length ? out : undefined;
  }

  /**
   * Mapea los campos de la BD (español) a camelCase
   */
  private static mapCaseFromDb(row: Record<string, unknown>): CaseWithCreator {
    const r = row;
    return {
      id: r.id as string,
      caseNumber: r.numero_tramite as string,
      title: r.titulo as string,
      description: r.descripcion as string | undefined,
      // Priorizar `estado_id` (FK actual). `estado` puede existir como legado y desalinearse.
      status: dbEstadoTramiteToApp((r.estado_id ?? r.estado) as string | number | null | undefined),
      createdBy: r.creado_por as string,
      currentAreaId: r.area_actual_id as number | undefined,
      dueDate: r.fecha_limite as Date | undefined,
      completedAt: r.completado_en as Date | undefined,
      createdAt: r.creado_en as Date,
      updatedAt: r.actualizado_en as Date,
      creatorName: r.nombre_creador as string,
      creatorEmail: r.email_creador as string,
      fileCount: parseInt(String(r.file_count ?? 0), 10) || 0,
      commentCount: parseInt(String(r.comment_count ?? 0), 10) || 0,
      advisorName: r.nombre_asesor as string | undefined,
      documentFileName: r.nombre_archivo_documento as string | undefined,
      odooCode: r.codigo_odoo as string | undefined,
      clientProvider: r.cliente_proveedor as string | undefined,
      documentType: r.tipo_documento as string | undefined,
      sharepointUrl: r.url_sharepoint as string | undefined,
      requestDate: r.fecha_solicitud as Date | undefined,
      requiredDeliveryDate: r.fecha_entrega_requerida as Date | undefined,
      urgencyJustification: r.justificacion_urgencia as string | undefined,
      signatureType: r.tipo_firma as string | undefined,
      templateType: r.tipo_plantilla as string | undefined,
      observations: r.observaciones as string | undefined,
      reviewAreaIds: [],
      returnAllowFileUpdate: r.permite_actualizacion_devolucion === true,
      lastReturnReason: (r.motivo_ultima_devolucion as string | undefined) ?? undefined,
      lastReturnAreaId: (r.area_ultima_devolucion_id as number | null | undefined) ?? undefined,
      returnHistory: CaseService.parseReturnHistory(r.historial_devoluciones),
      approvedReviewAreaIds: [],
      creatorAreaId: (r.area_creador_id as number | null | undefined) ?? null,
      routingFlow: (r.tipo_flujo as Case['routingFlow']) ?? null,
      supervisionAreaId: (r.area_supervision_id as number | null | undefined) ?? null,
      supervisionSupervisorName: (r.supervisor_supervision_nombre as string | null | undefined) ?? null,
      supervisionCompleted: r.supervision_completada === true,
      amountApplies: r.aplica_monto === true,
      amountValue: (() => {
        if (r.valor_monto == null || r.valor_monto === '') return null;
        const n = Number(r.valor_monto);
        return Number.isFinite(n) ? n : null;
      })(),
    };
  }
}
