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
import { CaseService } from '@/services/case.service';
import { notifyCaseSubscribers } from '@/lib/realtime/case-events';
import type { Session } from 'next-auth';
import type { PoolClient } from 'pg';

export const dynamic = 'force-dynamic';

function parseAreaId(raw: unknown): number | null {
  const n = parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function normalizeReviewAreasForSupervision(
  caseId: string,
  session: Session,
  raw: unknown
): Promise<UserAreaId[]> {
  if (!Array.isArray(raw)) {
    throw new ValidationError('Indique las áreas de revisión');
  }

  const sc = await casesStateColumn();
  const row = await query<{
    estado: string;
    routing_flow: string | null;
    supervision_completed: boolean;
    supervision_area_id: number | null;
  }>(
    `SELECT t.${sc} AS estado, t.tipo_flujo AS routing_flow,
            t.supervision_completada AS supervision_completed,
            ca_sup.id AS supervision_area_id
     FROM tramites t
     LEFT JOIN configuracion_areas ca_sup ON ca_sup.id = t.area_supervision_id
     WHERE t.id = $1`,
    [caseId]
  );
  if (row.rows.length === 0) throw new ValidationError('Trámite no encontrado');

  const c = row.rows[0];
  if (c.routing_flow !== 'SUPERVISION_CHAIN') {
    throw new ValidationError('Este trámite no usa el flujo con supervisión');
  }
  if (c.supervision_completed) {
    throw new ValidationError('Las áreas de revisión ya fueron confirmadas');
  }
  if (dbEstadoTramiteToApp(c.estado) !== 'SUBMITTED') {
    throw new ValidationError('Solo se puede asignar áreas cuando el trámite está enviado y pendiente de supervisión');
  }

  const supId = c.supervision_area_id;
  if (supId == null) {
    throw new ValidationError('El trámite no tiene área de supervisión asignada');
  }

  const isAdmin = session.user.role === 'ADMIN';
  const isSupervisorOfSupArea =
    session.user.role === 'AREA_USER' &&
    session.user.areaId === supId &&
    (await isUserSupervisorForArea(session.user.id, supId));

  if (!isAdmin && !isSupervisorOfSupArea) {
    throw new ForbiddenError(
      'Solo el supervisor titular del área de supervisión o un administrador pueden gestionar las áreas de revisión'
    );
  }

  const allowedRes = await query<{ id: number }>(
    `SELECT id FROM configuracion_areas WHERE activo = true AND seleccionable = true`
  );
  const allowed = new Set(allowedRes.rows.map((r) => r.id));
  if (supId != null) allowed.add(supId);

  const parsed = [
    ...new Set(raw.map((a) => parseAreaId(a)).filter((id): id is number => id != null)),
  ];
  const base = parsed.filter((id) => allowed.has(id));

  /** El área de supervisión participa en el circuito como una revisión más (aprueba y comenta como el resto). */
  const merged: UserAreaId[] = [...base];
  if (supId != null && !merged.includes(supId)) {
    merged.push(supId);
  }

  if (merged.length === 0) {
    throw new ValidationError('Ninguna área de revisión es válida');
  }
  return merged;
}

async function persistReviewAreasOnly(client: PoolClient, caseId: string, normalized: UserAreaId[]) {
  await client.query(`DELETE FROM tramite_areas_revision WHERE tramite_id = $1`, [caseId]);
  await client.query(
    `INSERT INTO tramite_areas_revision (tramite_id, area_id)
     SELECT $1, ca.id FROM configuracion_areas ca WHERE ca.id = ANY($2::int[])`,
    [caseId, normalized]
  );
}

/**
 * PATCH /api/cases/:id/supervision-review-areas
 * Guarda las áreas de revisión sin cerrar supervisión ni enviar a revisión (se puede volver a editar).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    caseIdSchema.parse({ id });

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const normalized = await normalizeReviewAreasForSupervision(id, session, body?.reviewAreas);

    await transaction(async (client) => {
      await persistReviewAreasOnly(client, id, normalized);
      await client.query(`UPDATE tramites SET actualizado_en = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
    });

    notifyCaseSubscribers(id);
    const updated = await CaseService.getCaseById(id);
    return successResponse(updated ?? { id });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/cases/:id/supervision-review-areas
 * Flujo 1: confirma áreas, marca supervisión completada y envía el trámite a revisión.
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
    const normalized = await normalizeReviewAreasForSupervision(id, session, body?.reviewAreas);

    await transaction(async (client) => {
      await persistReviewAreasOnly(client, id, normalized);

      await client.query(
        `UPDATE tramites
         SET supervision_completada = true,
             actualizado_en = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id]
      );
    });

    await CaseService.submitCase(id);
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO tramite_areas_aprobadas (tramite_id, area_id)
         SELECT $1, t.area_supervision_id
         FROM tramites t
         WHERE t.id = $1
           AND t.area_supervision_id IS NOT NULL
         ON CONFLICT DO NOTHING`,
        [id]
      );
    });
    notifyCaseSubscribers(id);

    const updated = await CaseService.getCaseById(id);
    return successResponse(updated ?? { id });
  } catch (error) {
    return errorResponse(error);
  }
}
