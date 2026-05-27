import { NextRequest } from 'next/server';
import { caseIdSchema } from '@/lib/validations/case.schema';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireAuth, canAccessCase } from '@/lib/auth/get-session';
import { query } from '@/lib/db';
import { notifyCaseSubscribers } from '@/lib/realtime/case-events';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cases/:id/review-presence
 * Áreas con al menos un usuario conectado revisando este trámite (últimos ~45 s).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    caseIdSchema.parse({ id });

    const caseResult = await query<{ created_by: string; current_area_id: number | null }>(
      `SELECT t.creado_por AS created_by, t.area_actual_id AS current_area_id
       FROM tramites t
       WHERE t.id = $1`,
      [id]
    );
    if (caseResult.rows.length === 0) {
      return successResponse({ areas: [] });
    }
    await canAccessCase(caseResult.rows[0].created_by, caseResult.rows[0].current_area_id ?? undefined);

    const r = await query<{ area: string; user_id: string; display_name: string }>(
      `SELECT
         ca.id::text AS area,
         p.usuario_id::text AS user_id,
         trim(u.nombre || ' ' || u.apellido) AS display_name
       FROM presencia_revision p
       JOIN usuarios u ON u.id = p.usuario_id
       JOIN configuracion_areas ca ON ca.id = p.area_usuario_id
       WHERE p.tramite_id = $1
         AND p.ultimo_visto_en > NOW() - INTERVAL '45 seconds'
       ORDER BY ca.orden, ca.id, u.apellido, u.nombre`,
      [id]
    );

    const presence = r.rows.map((row) => ({
      area: row.area,
      userId: row.user_id,
      displayName: row.display_name || 'Usuario',
    }));
    const areas = [...new Set(presence.map((p) => p.area))];

    return successResponse({ areas, presence });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/cases/:id/review-presence
 * Heartbeat: supervisor de área indica que está en el detalle revisando (pestaña proceso).
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    caseIdSchema.parse({ id });

    if (session.user.role !== 'AREA_USER' || session.user.areaId == null) {
      return successResponse({ ok: true });
    }

    const caseResult = await query<{ created_by: string; current_area_id: number | null }>(
      `SELECT t.creado_por AS created_by, t.area_actual_id AS current_area_id
       FROM tramites t
       WHERE t.id = $1`,
      [id]
    );
    if (caseResult.rows.length === 0) {
      return successResponse({ ok: false });
    }
    await canAccessCase(caseResult.rows[0].created_by, caseResult.rows[0].current_area_id ?? undefined);

    await query(
      `INSERT INTO presencia_revision (tramite_id, usuario_id, area_usuario_id, ultimo_visto_en)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (tramite_id, usuario_id) DO UPDATE SET
         area_usuario_id = EXCLUDED.area_usuario_id,
         ultimo_visto_en = EXCLUDED.ultimo_visto_en`,
      [id, session.user.id, session.user.areaId]
    );

    notifyCaseSubscribers(id, { throttle: true });
    return successResponse({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * DELETE /api/cases/:id/review-presence
 * Sale del detalle / deja de enviar heartbeat.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    caseIdSchema.parse({ id });

    await query('DELETE FROM presencia_revision WHERE tramite_id = $1 AND usuario_id = $2', [id, session.user.id]);
    notifyCaseSubscribers(id);
    return successResponse({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
