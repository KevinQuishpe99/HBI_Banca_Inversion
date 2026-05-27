import { query, transaction } from '@/lib/db';
import { dbEstadoTramiteToApp, TRAMITE_ESTADO_ID } from '@/lib/db/estado-tramite-map';
import { WorkflowProgressView } from '@/types/flow.types';
import { UserRole } from '@/types/user.types';
import { ForbiddenError, ValidationError } from '@/lib/utils/errors';
import { PoolClient } from 'pg';
import { NotificationService } from './notification.service';
import { FileService } from './file.service';
import {
  getRequiredAreasOrdered,
  getSupervisionChainIncompleteOrderedAreaIds,
} from '@/services/routing.service';

async function isAreaSupervisor(userId: string, areaId: number): Promise<boolean> {
  const r = await query<{ supervisor_id: string | null }>(
    `SELECT supervisor_id FROM configuracion_areas WHERE id = $1 LIMIT 1`,
    [areaId]
  );
  const sid = r.rows[0]?.supervisor_id;
  if (sid == null) return true;
  return sid === userId;
}

async function getAreaLabel(areaId: number): Promise<string> {
  const r = await query<{ nombre_area: string }>(
    `SELECT nombre_area FROM configuracion_areas WHERE id = $1`,
    [areaId]
  );
  return r.rows[0]?.nombre_area ?? `Área ${areaId}`;
}

async function getAreaLabelsMap(areaIds: number[]): Promise<Record<number, string>> {
  if (areaIds.length === 0) return {};
  const r = await query<{ id: number; nombre_area: string }>(
    `SELECT id, nombre_area FROM configuracion_areas WHERE id = ANY($1::int[])`,
    [areaIds]
  );
  return Object.fromEntries(r.rows.map((row) => [row.id, row.nombre_area]));
}

async function areaAllowsSigningById(areaId: number): Promise<boolean> {
  const r = await query<{ permite_firma: boolean }>(
    `SELECT permite_firma FROM configuracion_areas WHERE id = $1 AND activo = true`,
    [areaId]
  );
  return r.rows[0]?.permite_firma === true;
}

export class FlowService {
  static async getWorkflowProgress(caseId: string): Promise<WorkflowProgressView[]> {
    const cfg = await query<{
      tipo_flujo: string | null;
      supervision_completada: boolean | null;
      area_supervision_id: number | null;
    }>(
      `SELECT tipo_flujo, supervision_completada, area_supervision_id
       FROM tramites WHERE id = $1`,
      [caseId]
    );
    const row = cfg.rows?.[0];

    const approvedRes = await query<{ area_id: number }>(
      `SELECT area_id FROM tramite_areas_aprobadas WHERE tramite_id = $1`,
      [caseId]
    );
    const approved = approvedRes.rows.map((r) => r.area_id);

    const ordered = await transaction(async (client: PoolClient) => {
      return getRequiredAreasOrdered(client, caseId);
    });

    if (
      ordered.length === 0 &&
      row?.tipo_flujo === 'SUPERVISION_CHAIN' &&
      !row?.supervision_completada &&
      row?.area_supervision_id != null
    ) {
      const supId = row.area_supervision_id;
      const previewOrdered = await transaction(async (client: PoolClient) =>
        getSupervisionChainIncompleteOrderedAreaIds(client, caseId, supId)
      );
      const labels = await getAreaLabelsMap(previewOrdered);
      const out: WorkflowProgressView[] = [];
      let stepOrder = 1;
      for (const areaId of previewOrdered) {
        const isSupervisionArea = areaId === supId;
        const areaLabel = labels[areaId] ?? `Área ${areaId}`;
        out.push({
          caseId,
          workflowTemplateId: '',
          workflowName: 'Revisión por áreas',
          stepOrder: stepOrder++,
          stepName: isSupervisionArea
            ? `${areaLabel} — definir áreas y enviar a revisión`
            : areaLabel,
          requiredArea: String(areaId),
          stepStatus: isSupervisionArea ? 'IN_PROGRESS' : 'PENDING',
          reviewedByName: undefined,
          completedAt: undefined,
        });
      }
      return out;
    }

    const labels = await getAreaLabelsMap(ordered);

    let stepOrder = 1;
    let firstPending = true;
    const out: WorkflowProgressView[] = [];
    for (const areaId of ordered) {
      const isApproved = approved.includes(areaId);
      let stepStatus: WorkflowProgressView['stepStatus'] = 'PENDING';
      if (isApproved) stepStatus = 'APPROVED';
      else if (firstPending) {
        stepStatus = 'IN_PROGRESS';
        firstPending = false;
      }
      out.push({
        caseId,
        workflowTemplateId: '',
        workflowName: 'Revisión por áreas',
        stepOrder: stepOrder++,
        stepName: labels[areaId] ?? `Área ${areaId}`,
        requiredArea: String(areaId),
        stepStatus,
        reviewedByName: undefined,
        completedAt: undefined,
      });
    }
    return out;
  }

  static async userHasActiveReviewStep(
    caseId: string,
    userAreaId: number | undefined,
    userId?: string
  ): Promise<boolean> {
    if (!userAreaId || !userId) return false;
    if (!(await isAreaSupervisor(userId, userAreaId))) return false;
    return transaction(async (client: PoolClient) => {
      const meta = await client.query<{
        tipo_flujo: string | null;
        supervision_completada: boolean | null;
        area_supervision_id: number | null;
      }>(
        `SELECT tipo_flujo, supervision_completada, area_supervision_id FROM tramites WHERE id = $1`,
        [caseId]
      );
      const m = meta.rows[0];
      if (
        m?.tipo_flujo === 'SUPERVISION_CHAIN' &&
        !m?.supervision_completada &&
        m?.area_supervision_id != null &&
        userAreaId === m.area_supervision_id &&
        (await isAreaSupervisor(userId, userAreaId))
      ) {
        return true;
      }

      const ordered = await getRequiredAreasOrdered(client, caseId);
      const approvedRes = await client.query<{ area_id: number }>(
        `SELECT area_id FROM tramite_areas_aprobadas WHERE tramite_id = $1`,
        [caseId]
      );
      const approved = approvedRes.rows.map((r) => r.area_id);
      const firstPending = ordered.find((a) => !approved.includes(a));
      return firstPending === userAreaId;
    });
  }

  /**
   * Comercial: cualquier usuario del área (no solo el supervisor) puede comentar archivos
   * si Comercial forma parte del circuito de revisión del trámite.
   */
  static async comercialAreaMayCommentFiles(caseId: string, userAreaId: number | undefined): Promise<boolean> {
    if (userAreaId == null) return false;
    return transaction(async (client: PoolClient) => {
      const sup = await client.query<{ area_supervision_id: number | null }>(
        `SELECT area_supervision_id FROM tramites WHERE id = $1`,
        [caseId]
      );
      if (sup.rows[0]?.area_supervision_id !== userAreaId) return false;
      const ordered = await getRequiredAreasOrdered(client, caseId);
      return ordered.includes(userAreaId);
    });
  }

  /** Antes permitía comentar en paralelo; el circuito es secuencial entre áreas finales (p. ej. Legal → Director). */
  static async directorGeneralMayCommentFilesInParallelReview(_caseId: string): Promise<boolean> {
    void _caseId;
    return false;
  }

  static async approveStep(
    caseId: string,
    userId: string,
    userRole: UserRole,
    userAreaId: number | undefined,
    comments?: string
  ): Promise<void> {
    let caseInfo: { numero_tramite: string; titulo: string; creado_por: string } | undefined;
    let caseReachedTramiteCompletado = false;
    let approvedAreaId: number | null = null;

    await transaction(async (client: PoolClient) => {
      const caseResult = await client.query(
        `SELECT t.numero_tramite, t.titulo, t.creado_por, u.nombre || ' ' || u.apellido as nombre_creador
         FROM tramites t
         JOIN usuarios u ON t.creado_por = u.id
         WHERE t.id = $1`,
        [caseId]
      );
      caseInfo = caseResult.rows[0];

      const required = await getRequiredAreasOrdered(client, caseId);
      if (required.length === 0) {
        throw new ValidationError(
          'Este trámite aún no tiene áreas de revisión asignadas por el área de supervisión'
        );
      }

      await client.query(`SELECT id FROM tramites WHERE id = $1 FOR UPDATE`, [caseId]);
      const approvedRes = await client.query<{ area_id: number }>(
        `SELECT area_id FROM tramite_areas_aprobadas WHERE tramite_id = $1`,
        [caseId]
      );
      const approved = approvedRes.rows.map((r) => r.area_id);

      if (userRole !== 'ADMIN') {
        if (!userAreaId || !required.includes(userAreaId)) {
          throw new ForbiddenError('Su área no forma parte de la revisión de este trámite');
        }
        if (approved.includes(userAreaId)) {
          throw new ValidationError('Su área ya consta como aprobada en este trámite');
        }
        if (!(await isAreaSupervisor(userId, userAreaId))) {
          throw new ForbiddenError('Solo el supervisor del área puede aprobar');
        }
        approvedAreaId = userAreaId;
      } else {
        const next = required.find((a) => !approved.includes(a));
        if (!next) throw new ValidationError('No quedan áreas pendientes de aprobar');
        approvedAreaId = next;
      }

      const ua = approvedAreaId as number;
      if (!required.includes(ua)) {
        throw new ValidationError('Área inválida para aprobar');
      }
      if (approved.includes(ua)) {
        throw new ValidationError('El área ya fue aprobada');
      }

      const firstPending = required.find((a) => !approved.includes(a));
      if (firstPending !== ua) {
        const label = await getAreaLabel(firstPending!);
        throw new ValidationError(
          `Aún hay áreas previas sin finalizar. El siguiente turno corresponde a: ${label}.`
        );
      }

      await client.query(
        `INSERT INTO tramite_areas_aprobadas (tramite_id, area_id) VALUES ($1, $2)`,
        [caseId, ua]
      );
      const newApproved = [...approved, ua];

      const allDone = required.every((a) => newApproved.includes(a));

      const canCompleteAreas = (await client.query<{ area_id: number }>(
        `SELECT id AS area_id FROM configuracion_areas WHERE activo = true AND puede_completar_tramite = true`
      )).rows.map((r) => r.area_id);
      const sigAreas = (await client.query<{ area_id: number }>(
        `SELECT id AS area_id FROM configuracion_areas WHERE activo = true AND permite_firma = true`
      )).rows.map((r) => r.area_id);
      const pendingSigning = sigAreas.filter((a) => required.includes(a) && !newApproved.includes(a));
      if (pendingSigning.length > 0) {
        await FileService.ensureDirectorSigningRowsForCase(caseId, client);
      }

      if (allDone) {
        const canSetTramiteCompletado = canCompleteAreas.includes(ua);
        if (canSetTramiteCompletado) {
          caseReachedTramiteCompletado = true;
          await client.query(
            `UPDATE tramites
             SET estado_id = $2, area_actual_id = NULL, completado_en = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [caseId, TRAMITE_ESTADO_ID.COMPLETED]
          );
        } else {
          await client.query(
            `UPDATE tramites
             SET estado_id = $2, area_actual_id = NULL, completado_en = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [caseId, TRAMITE_ESTADO_ID.APPROVED]
          );
        }
      } else {
        await client.query(
          `UPDATE tramites SET estado_id = $2, area_actual_id = NULL WHERE id = $1`,
          [caseId, TRAMITE_ESTADO_ID.IN_REVIEW]
        );
      }

      await client.query(
        `INSERT INTO registro_auditoria (tramite_id, usuario_id, accion, comentario)
         VALUES ($1, $2, 'APPROVED', $3)`,
        [caseId, userId, comments ?? null]
      );
    });

    if (caseReachedTramiteCompletado && caseInfo) {
      await NotificationService.notifyCaseCompleted(
        caseId,
        caseInfo.numero_tramite,
        caseInfo.titulo,
        caseInfo.creado_por
      );
    } else if (approvedAreaId != null && caseInfo) {
      const approvedAreaLabel = await getAreaLabel(approvedAreaId);
      await NotificationService.notifyCaseApproved(
        caseId,
        caseInfo.numero_tramite,
        caseInfo.titulo,
        caseInfo.creado_por,
        approvedAreaLabel,
        { approvedByUserId: userId, comments }
      );
    }
  }

  static async rejectStep(
    _caseId: string,
    _userId: string,
    _userRole: UserRole,
    _userArea: number | undefined,
    _comments: string
  ): Promise<void> {
    void _caseId;
    void _userId;
    void _userRole;
    void _userArea;
    void _comments;
    throw new ValidationError(
      'El sistema no utiliza rechazo de trámite. Use «Devolver trámite» para enviarlo al solicitante con comentarios.'
    );
  }

  static buildReturnCaseCommentBlock(
    returnReason: string,
    body:
      | { variant: 'standard'; comments: string }
      | {
          variant: 'legal';
          legalObservations: string;
          legalClientRecommendations: string;
          legalScheduleMeeting: boolean;
        }
  ): string {
    if (body.variant === 'standard') {
      return `${returnReason}\n\n${body.comments.trim()}`;
    }
    const obs = body.legalObservations.trim() || '—';
    const rec = body.legalClientRecommendations.trim() || '—';
    return [
      returnReason,
      '',
      'Observaciones legales:',
      obs,
      '',
      'Recomendaciones de acciones con el cliente / proveedor:',
      rec,
      '',
      `Agendar reunión: ${body.legalScheduleMeeting ? 'Sí' : 'No'}`,
    ].join('\n');
  }

  private static linesFromResubmitFileAudits(rows: { valor_nuevo: unknown }[]): string[] {
    const lines: string[] = [];
    for (const row of rows) {
      const nv = row.valor_nuevo;
      let obj: Record<string, unknown> | null = null;
      if (nv == null) continue;
      if (typeof nv === 'string') {
        try {
          const j = JSON.parse(nv) as unknown;
          obj = typeof j === 'object' && j !== null && !Array.isArray(j) ? (j as Record<string, unknown>) : null;
        } catch {
          continue;
        }
      } else if (typeof nv === 'object' && !Array.isArray(nv)) {
        obj = nv as Record<string, unknown>;
      }
      if (!obj) continue;
      const fileName = typeof obj.fileName === 'string' ? obj.fileName : 'Archivo';
      if (obj.replaced === true) {
        lines.push(`• Actualización de documento: ${fileName}`);
        continue;
      }
      const vRaw = obj.version;
      const version = typeof vRaw === 'number' ? vRaw : Number(vRaw ?? 1);
      const ver = Number.isFinite(version) ? version : 1;
      if (ver > 1) {
        lines.push(`• Nueva versión subida: ${fileName} (v${ver})`);
      } else {
        lines.push(`• Documento añadido: ${fileName}`);
      }
    }
    return lines;
  }

  static async returnCase(
    caseId: string,
    userId: string,
    userRole: UserRole,
    userAreaId: number | undefined,
    returnReason: string,
    allowFileUpdate: boolean,
    body:
      | { variant: 'standard'; comments: string }
      | {
          variant: 'legal';
          legalObservations: string;
          legalClientRecommendations: string;
          legalScheduleMeeting: boolean;
        }
  ): Promise<void> {
    const fullCommentContent = FlowService.buildReturnCaseCommentBlock(returnReason, body);

    let caseInfo: { numero_tramite: string; titulo: string; creado_por: string } | undefined;
    let currentAreaId: number | null = null;

    await transaction(async (client: PoolClient) => {
      const caseResult = await client.query(
        `SELECT t.numero_tramite, t.titulo, t.creado_por
         FROM tramites t
         WHERE t.id = $1`,
        [caseId]
      );
      caseInfo = caseResult.rows[0];

      const ordered = await getRequiredAreasOrdered(client, caseId);
      const approvedRes = await client.query<{ area_id: number }>(
        `SELECT area_id FROM tramite_areas_aprobadas WHERE tramite_id = $1`,
        [caseId]
      );
      const approved = approvedRes.rows.map((r) => r.area_id);
      const firstPending = ordered.find((a) => !approved.includes(a));
      if (!firstPending) {
        throw new ValidationError('No hay área pendiente de revisión para devolver');
      }
      currentAreaId = firstPending;

      if (userRole !== 'ADMIN' && (userRole !== 'AREA_USER' || userAreaId !== currentAreaId)) {
        const label = await getAreaLabel(currentAreaId);
        throw new ForbiddenError(`Solo usuarios del área ${label} pueden devolver este paso`);
      }
      if (
        userRole !== 'ADMIN' &&
        currentAreaId != null &&
        !(await isAreaSupervisor(userId, currentAreaId))
      ) {
        throw new ForbiddenError('Solo el supervisor del área puede devolver el trámite en este paso');
      }

      const legalObs =
        body.variant === 'legal' ? (body.legalObservations.trim() || null) : null;
      const legalRec =
        body.variant === 'legal' ? (body.legalClientRecommendations.trim() || null) : null;
      const legalMeet = body.variant === 'legal' ? body.legalScheduleMeeting : null;

      // Mantener aprobaciones previas: devolver afecta al paso actual, no reinicia áreas ya revisadas.

      await client.query(
        `UPDATE tramites SET
           estado_id = $8,
           area_actual_id = NULL,
           permite_actualizacion_devolucion = $2,
           motivo_ultima_devolucion = $3,
           area_ultima_devolucion_id = $4,
           historial_devoluciones = COALESCE(historial_devoluciones, '[]'::jsonb) || jsonb_build_array(
             jsonb_strip_nulls(jsonb_build_object(
               'area', $4::int,
               'reason', $3::text,
               'allowFileUpdate', $2::boolean,
               'at', to_jsonb(now()::timestamptz),
               'legalObservations', $5::text,
               'legalClientRecommendations', $6::text,
               'legalScheduleMeeting', $7::boolean
             ))
           )
         WHERE id = $1`,
        [
          caseId,
          allowFileUpdate,
          returnReason,
          currentAreaId,
          legalObs,
          legalRec,
          legalMeet,
          TRAMITE_ESTADO_ID.RETURNED,
        ]
      );

      await client.query(
        `INSERT INTO comentarios (tramite_id, usuario_id, contenido, es_interno)
         VALUES ($1, $2, $3, false)`,
        [caseId, userId, fullCommentContent]
      );

      await client.query(
        `INSERT INTO registro_auditoria (tramite_id, usuario_id, accion, comentario)
         VALUES ($1, $2, 'RETURNED', $3)`,
        [caseId, userId, returnReason]
      );
    });

    if (currentAreaId != null && caseInfo) {
      const areaLabel = await getAreaLabel(currentAreaId);
      await NotificationService.notifyCaseReturned(
        caseId,
        caseInfo.numero_tramite,
        caseInfo.titulo,
        caseInfo.creado_por,
        areaLabel,
        returnReason,
        { returnedByUserId: userId, fullDetail: fullCommentContent }
      );
    }
  }

  static async resubmitCase(caseId: string, userId: string): Promise<void> {
    let caseInfo: { numero_tramite: string; titulo: string; creado_por: string; nombre_creador: string } | undefined;
    let targetAreas: number[] = [];

    await transaction(async (client: PoolClient) => {
      const caseResult = await client.query(
        `SELECT t.numero_tramite, t.titulo, t.creado_por, u.nombre || ' ' || u.apellido as nombre_creador
         FROM tramites t
         JOIN usuarios u ON t.creado_por = u.id
         WHERE t.id = $1`,
        [caseId]
      );
      caseInfo = caseResult.rows[0];

      targetAreas = await getRequiredAreasOrdered(client, caseId);

      // Al reenviar, conservar áreas previamente aprobadas para continuar desde el paso devuelto.

      await client.query(
        `UPDATE tramites
         SET estado_id = $2,
             area_actual_id = NULL,
             permite_actualizacion_devolucion = false,
             motivo_ultima_devolucion = NULL,
             area_ultima_devolucion_id = NULL
         WHERE id = $1`,
        [caseId, TRAMITE_ESTADO_ID.IN_REVIEW]
      );

      const lastReturn = await client.query<{ t: Date | null }>(
        `SELECT MAX(creado_en) AS t FROM registro_auditoria WHERE tramite_id = $1 AND accion = 'RETURNED'`,
        [caseId]
      );
      const prevResubmit = await client.query<{ t: Date | null }>(
        `SELECT MAX(creado_en) AS t FROM registro_auditoria
         WHERE tramite_id = $1
           AND (
             accion::text = 'RESUBMITTED'
             OR (accion::text = 'SUBMITTED' AND valor_nuevo @> '{"resubmittedAfterReturn": true}'::jsonb)
           )`,
        [caseId]
      );
      const toMs = (d: unknown): number => {
        if (d == null) return -Infinity;
        const t = new Date(d as string | Date).getTime();
        return Number.isNaN(t) ? -Infinity : t;
      };
      const lowerMs = Math.max(toMs(lastReturn.rows[0]?.t), toMs(prevResubmit.rows[0]?.t));
      const lowerBoundAt = lowerMs === -Infinity ? null : new Date(lowerMs);

      let resubmitComments: string;
      if (lowerBoundAt) {
        const fileAudits = await client.query<{ valor_nuevo: unknown }>(
          `SELECT valor_nuevo FROM registro_auditoria
           WHERE tramite_id = $1 AND accion = 'FILE_UPLOADED' AND creado_en > $2
           ORDER BY creado_en ASC`,
          [caseId, lowerBoundAt]
        );
        const detailLines = FlowService.linesFromResubmitFileAudits(fileAudits.rows);
        resubmitComments =
          detailLines.length > 0
            ? ['Cambios en documentos antes del reenvío:', ...detailLines].join('\n')
            : 'Sin cambios en documentos desde la última devolución (solo reenvío a revisión).';
      } else {
        resubmitComments =
          'No hay registro de devolución ni reenvío previo; no se listan cambios de documentos.';
      }

      const enumLabelsRes = await client.query<{ label: string }>(
        `SELECT e.enumlabel AS label
         FROM pg_enum e
         INNER JOIN pg_type t ON e.enumtypid = t.oid
         INNER JOIN pg_namespace n ON n.oid = t.typnamespace
         WHERE n.nspname = 'public'
           AND t.typname = 'action_type'`
      );
      const actionLabels = new Set(enumLabelsRes.rows.map((r) => String(r.label)));

      if (actionLabels.has('RESUBMITTED')) {
        await client.query(
          `INSERT INTO registro_auditoria (tramite_id, usuario_id, accion, comentario)
           VALUES ($1, $2, 'RESUBMITTED', $3)`,
          [caseId, userId, resubmitComments]
        );
      } else if (actionLabels.has('SUBMITTED')) {
        await client.query(
          `INSERT INTO registro_auditoria (tramite_id, usuario_id, accion, comentario, valor_nuevo)
           VALUES ($1, $2, 'SUBMITTED', $3, $4::jsonb)`,
          [caseId, userId, resubmitComments, JSON.stringify({ resubmittedAfterReturn: true })]
        );
      }
    });

    if (targetAreas.length && caseInfo) {
      await NotificationService.notifyAreaCaseResubmitted(
        caseId,
        caseInfo.numero_tramite,
        caseInfo.titulo,
        targetAreas[0],
        caseInfo.nombre_creador
      );
    }
  }

  static async completeCaseLegalEarly(
    caseId: string,
    userId: string,
    userRole: UserRole,
    userAreaId: number | undefined,
    comments?: string
  ): Promise<void> {
    if (userRole !== 'ADMIN') {
      if (!userAreaId || !(await areaAllowsSigningById(userAreaId))) {
        throw new ForbiddenError('Solo un área con permiso de firma puede dar el trámite por completado anticipadamente');
      }
      if (!(await isAreaSupervisor(userId, userAreaId))) {
        throw new ForbiddenError('Solo el supervisor del área puede completar el trámite anticipadamente');
      }
    }

    let caseInfo: { numero_tramite: string; titulo: string; creado_por: string } | undefined;

    await transaction(async (client: PoolClient) => {
      const caseResult = await client.query(
        `SELECT t.numero_tramite, t.titulo, t.creado_por, t.estado_id AS estado
         FROM tramites t
         WHERE t.id = $1`,
        [caseId]
      );
      if (caseResult.rows.length === 0) {
        throw new ValidationError('Trámite no encontrado');
      }
      caseInfo = caseResult.rows[0];
      if (dbEstadoTramiteToApp((caseResult.rows[0] as { estado: number }).estado) !== 'IN_REVIEW') {
        throw new ValidationError('Solo se puede completar así cuando el trámite está en revisión');
      }

      const required = await getRequiredAreasOrdered(client, caseId);
      await client.query(`SELECT id FROM tramites WHERE id = $1 FOR UPDATE`, [caseId]);
      const approvedRes = await client.query<{ area_id: number }>(
        `SELECT area_id FROM tramite_areas_aprobadas WHERE tramite_id = $1`,
        [caseId]
      );
      const approved = approvedRes.rows.map((r) => r.area_id);

      const canCompleteAreas = (await client.query<{ area_id: number }>(
        `SELECT id AS area_id FROM configuracion_areas WHERE activo = true AND puede_completar_tramite = true`
      )).rows.map((r) => r.area_id);
      const othersPending = required.filter(
        (a) => !canCompleteAreas.includes(a) && !approved.includes(a)
      );
      if (othersPending.length > 0) {
        throw new ValidationError(
          'Aún hay áreas previas sin finalizar. Complete primero las revisiones anteriores.'
        );
      }
      if (userAreaId && approved.includes(userAreaId)) {
        throw new ValidationError('Su área ya figura como aprobada');
      }

      for (const areaId of required) {
        await client.query(
          `INSERT INTO tramite_areas_aprobadas (tramite_id, area_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [caseId, areaId]
        );
      }

      await client.query(
        `UPDATE tramites
         SET estado_id = $2,
             area_actual_id = NULL,
             completado_en = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [caseId, TRAMITE_ESTADO_ID.COMPLETED]
      );

      await client.query(
        `INSERT INTO registro_auditoria (tramite_id, usuario_id, accion, comentario)
         VALUES ($1, $2, 'COMPLETED', $3)`,
        [caseId, userId, comments ?? 'Completado por Legal (sin Director General)']
      );
    });

    if (caseInfo) {
      try {
        await NotificationService.notifyCaseLegalCompletedEarly(
          caseId,
          caseInfo.numero_tramite,
          caseInfo.titulo,
          caseInfo.creado_por,
          userId
        );
      } catch (e) {
        console.error('[completeCaseLegalEarly] notifyCaseLegalCompletedEarly failed', { caseId }, e);
      }
    }
  }
}
