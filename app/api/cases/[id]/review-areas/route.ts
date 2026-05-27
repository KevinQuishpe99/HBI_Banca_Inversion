import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/get-session';
import { caseIdSchema } from '@/lib/validations/case.schema';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ForbiddenError, ValidationError } from '@/lib/utils/errors';
import { query, transaction } from '@/lib/db';
import { casesStateColumn } from '@/lib/db/cases-schema-compat';
import { dbEstadoTramiteToApp } from '@/lib/db/estado-tramite-map';
import type { UserAreaId } from '@/types/user.types';
import { isUserSupervisorForArea } from '@/lib/auth/area-supervisor';
import { NotificationService } from '@/services/notification.service';
import { notifyCaseSubscribers } from '@/lib/realtime/case-events';

export const dynamic = 'force-dynamic';

function parseAreaId(raw: unknown): number | null {
  const n = parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Lista de ids de área como string (compat con clientes que usan `area` como en /api/meta/areas). */
async function getReviewAreas(caseId: string): Promise<string[]> {
  const r = await query<{ area: string }>(
    `SELECT ca.id::text AS area
     FROM tramite_areas_revision tar
     JOIN configuracion_areas ca ON ca.id = tar.area_id
     WHERE tar.tramite_id = $1
     ORDER BY ca.id`,
    [caseId]
  );
  return r.rows.map((row) => row.area);
}

async function getApprovedAreas(caseId: string): Promise<string[]> {
  const r = await query<{ area: string }>(
    `SELECT ca.id::text AS area
     FROM tramite_areas_aprobadas taa
     JOIN configuracion_areas ca ON ca.id = taa.area_id
     WHERE taa.tramite_id = $1`,
    [caseId]
  );
  return r.rows.map((row) => row.area);
}

/**
 * POST /api/cases/:id/review-areas
 * Agrega un área seleccionable a la revisión del trámite (permitido por LEGAL o ADMIN).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    caseIdSchema.parse({ id });

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const areaId = parseAreaId(body?.area);
    if (areaId == null) throw new ValidationError('Área requerida');

    if (
      !(
        session.user.role === 'ADMIN' ||
        (session.user.role === 'AREA_USER' &&
          (session.user.isSigningArea || session.user.isFinalStepArea))
      )
    ) {
      throw new ForbiddenError('Solo Legal, Director General o Admin pueden agregar áreas a la revisión');
    }
    if (
      session.user.role === 'AREA_USER' &&
      (session.user.isSigningArea || session.user.isFinalStepArea) &&
      session.user.areaId != null &&
      !(await isUserSupervisorForArea(session.user.id, session.user.areaId))
    ) {
      throw new ForbiddenError('Solo el supervisor del área puede agregar áreas a la revisión');
    }

    const sc = await casesStateColumn();
    const caseRow = await query<{
      estado: string;
      case_number: string;
      title: string;
      created_by: string;
      creator_name: string;
    }>(
      `SELECT t.${sc} AS estado, t.numero_tramite AS case_number, t.titulo AS title,
              t.creado_por AS created_by,
              u.nombre || ' ' || u.apellido AS creator_name
       FROM tramites t
       JOIN usuarios u ON u.id = t.creado_por
       WHERE t.id = $1`,
      [id]
    );
    if (caseRow.rows.length === 0) throw new ValidationError('Trámite no encontrado');
    if (dbEstadoTramiteToApp(caseRow.rows[0].estado) !== 'IN_REVIEW') {
      throw new ValidationError('Solo puede agregar áreas mientras el trámite está en revisión');
    }

    const ok = await query<{ id: number }>(
      `SELECT id FROM configuracion_areas WHERE activo = true AND seleccionable = true AND id = $1`,
      [areaId]
    );
    if (ok.rows.length === 0) throw new ValidationError('Área inválida o no seleccionable');
    const addedAreaId = ok.rows[0]!.id;

    const info = caseRow.rows[0];
    const areaKey = String(areaId);
    const existing = await getReviewAreas(id);
    if (existing.includes(areaKey)) {
      return successResponse({ message: 'El área ya estaba agregada', reviewAreas: existing });
    }

    await transaction(async (client) => {
      await client.query(
        `INSERT INTO tramite_areas_revision (tramite_id, area_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [id, addedAreaId]
      );
    });

    try {
      await NotificationService.notifyAreaNewCase(
        id,
        info.case_number,
        info.title,
        addedAreaId,
        info.creator_name
      );
    } catch (notifyErr) {
      console.error('[POST review-areas] notifyAreaNewCase failed', { caseId: id, areaId }, notifyErr);
    }

    const updatedAreas = await getReviewAreas(id);
    notifyCaseSubscribers(id);
    return successResponse({ message: 'Área agregada', reviewAreas: updatedAreas });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * PATCH /api/cases/:id/review-areas
 * Reemplaza la lista de áreas opcionales en revisión (Legal, Director General o Admin).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    caseIdSchema.parse({ id });

    if (
      !(
        session.user.role === 'ADMIN' ||
        (session.user.role === 'AREA_USER' &&
          (session.user.isSigningArea || session.user.isFinalStepArea))
      )
    ) {
      throw new ForbiddenError('Solo Legal, Director General o Admin pueden modificar las áreas de revisión');
    }
    if (
      session.user.role === 'AREA_USER' &&
      (session.user.isSigningArea || session.user.isFinalStepArea) &&
      session.user.areaId != null &&
      !(await isUserSupervisorForArea(session.user.id, session.user.areaId))
    ) {
      throw new ForbiddenError('Solo el supervisor del área puede modificar las áreas de revisión');
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const raw = body?.reviewAreas;
    if (!Array.isArray(raw)) {
      throw new ValidationError('Se requiere reviewAreas (array de áreas)');
    }

    const sc = await casesStateColumn();
    const caseRow = await query<{
      estado: string;
      case_number: string;
      title: string;
      created_by: string;
      creator_name: string;
    }>(
      `SELECT t.${sc} AS estado, t.numero_tramite AS case_number, t.titulo AS title,
              t.creado_por AS created_by,
              u.nombre || ' ' || u.apellido AS creator_name
       FROM tramites t
       JOIN usuarios u ON u.id = t.creado_por
       WHERE t.id = $1`,
      [id]
    );
    if (caseRow.rows.length === 0) throw new ValidationError('Trámite no encontrado');
    if (dbEstadoTramiteToApp(caseRow.rows[0].estado) !== 'IN_REVIEW') {
      throw new ValidationError('Solo puede modificar áreas mientras el trámite está en revisión');
    }

    const allowedRes = await query<{ id: number }>(
      `SELECT id FROM configuracion_areas
       WHERE activo = true AND seleccionable = true`
    );
    const allowed = new Set(allowedRes.rows.map((r) => r.id));

    const parsedIds = [
      ...new Set(raw.map((a) => parseAreaId(a)).filter((n): n is number => n != null)),
    ];
    const normalized: UserAreaId[] = parsedIds.filter((aid) => allowed.has(aid));

    const info = caseRow.rows[0];
    const existing = await getReviewAreas(id);
    const existingSet = new Set(existing);
    const normalizedKeys = normalized.map(String);
    const added = normalizedKeys.filter((a) => !existingSet.has(a));
    const removed = [...existingSet].filter((a) => !normalizedKeys.includes(a));

    let hasPresenceTable = false;
    try {
      const chk = await query<{ e: boolean }>(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'presencia_revision'
        ) AS e`
      );
      hasPresenceTable = !!chk.rows[0]?.e;
    } catch {
      hasPresenceTable = false;
    }

    const approvedForPatch = await getApprovedAreas(id);

    for (const areaKey of removed) {
      if (approvedForPatch.includes(areaKey)) {
        throw new ValidationError(
          `No puede quitar el área ${areaKey} porque ya consta como aprobada en este trámite`
        );
      }
      const rmId = parseAreaId(areaKey);
      if (rmId == null) continue;
      if (hasPresenceTable) {
        const pres = await query(
          `SELECT 1
           FROM presencia_revision pr
           JOIN configuracion_areas ca ON ca.id = pr.area_usuario_id
           WHERE pr.tramite_id = $1
             AND ca.id = $2
             AND pr.ultimo_visto_en > NOW() - INTERVAL '45 seconds'
           LIMIT 1`,
          [id, rmId]
        );
        if (pres.rows.length > 0) {
          throw new ValidationError(
            `No puede quitar el área ${areaKey} porque un usuario de esa área está revisando el trámite ahora`
          );
        }
      }
    }

    await transaction(async (client) => {
      await client.query(`DELETE FROM tramite_areas_revision WHERE tramite_id = $1`, [id]);
      if (normalized.length > 0) {
        await client.query(
          `INSERT INTO tramite_areas_revision (tramite_id, area_id)
           SELECT $1, ca.id FROM configuracion_areas ca WHERE ca.id = ANY($2::int[])`,
          [id, normalized]
        );
      }
    });

    for (const areaKey of added) {
      const notifyAreaId = parseAreaId(areaKey);
      if (notifyAreaId == null) continue;
      try {
        await NotificationService.notifyAreaNewCase(
          id,
          info.case_number,
          info.title,
          notifyAreaId,
          info.creator_name
        );
      } catch (notifyErr) {
        console.error('[PATCH review-areas] notifyAreaNewCase failed', { caseId: id, areaKey }, notifyErr);
      }
    }

    notifyCaseSubscribers(id);
    return successResponse({
      message: 'Áreas de revisión actualizadas',
      reviewAreas: normalized.map(String),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
