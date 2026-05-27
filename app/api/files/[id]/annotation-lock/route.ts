import { NextRequest } from 'next/server';
import { FileService } from '@/services/file.service';
import { fileIdSchema } from '@/lib/validations/file.schema';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireAuth, assertCanPostFileComment } from '@/lib/auth/get-session';
import { query } from '@/lib/db';
import { ValidationError, ForbiddenError } from '@/lib/utils/errors';
import { casesStateColumn } from '@/lib/db/cases-schema-compat';
import { dbEstadoTramiteToApp } from '@/lib/db/estado-tramite-map';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/files/:id/annotation-lock
 * Estado del bloqueo de anotación (otro usuario con sesión activa).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    fileIdSchema.parse({ id });

    const fileRow = await FileService.getFileById(id);
    if (!fileRow) {
      throw new ValidationError('Archivo no encontrado');
    }

    await query(`DELETE FROM bloqueo_anotacion WHERE ultimo_latido < NOW() - INTERVAL '45 seconds'`);

    const r = await query<{
      user_id: string;
      user_area: string;
      display_name: string;
    }>(
      `SELECT l.usuario_id::text AS user_id, ca.nombre_area AS user_area,
              trim(u.nombre || ' ' || u.apellido) AS display_name
       FROM bloqueo_anotacion l
       JOIN usuarios u ON u.id = l.usuario_id
       JOIN configuracion_areas ca ON ca.id = l.area_usuario_id
       WHERE l.archivo_id = $1
         AND l.ultimo_latido > NOW() - INTERVAL '45 seconds'`,
      [id]
    );

    if (r.rows.length === 0) {
      return successResponse({ locked: false });
    }
    const row = r.rows[0];
    return successResponse({
      locked: true,
      userId: row.user_id,
      userArea: row.user_area,
      displayName: row.display_name || 'Usuario',
    });
  } catch (error) {
    return errorResponse(error);
  }
}

type Body = { action?: string };

/**
 * POST /api/files/:id/annotation-lock
 * action: acquire | heartbeat — admin omite bloqueo (siempre ok).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    fileIdSchema.parse({ id });

    let body: Body = {};
    try {
      body = (await request.json()) as Body;
    } catch {
      /* empty */
    }
    const action = body.action === 'heartbeat' ? 'heartbeat' : 'acquire';

    const fileRow = await FileService.getFileById(id);
    if (!fileRow) {
      throw new ValidationError('Archivo no encontrado');
    }

    const sc = await casesStateColumn();
    const caseResult = await query<{ estado: string }>(
      `SELECT ${sc} AS estado FROM tramites WHERE id = $1`,
      [fileRow.caseId]
    );
    if (caseResult.rows.length === 0) {
      throw new ValidationError('Trámite no encontrado');
    }
    const status = dbEstadoTramiteToApp(caseResult.rows[0].estado);

    if (fileRow.isSigned || fileRow.isFinal) {
      throw new ForbiddenError('No se pueden anotar este documento');
    }

    await assertCanPostFileComment(session.user, fileRow.caseId, status);

    if (session.user.role === 'ADMIN') {
      return successResponse({ ok: true, admin: true });
    }

    if (session.user.role !== 'AREA_USER' || session.user.areaId == null) {
      throw new ForbiddenError('Solo usuarios de área pueden reservar anotaciones');
    }

    const uid = session.user.id;
    const areaId = session.user.areaId;

    await query(`DELETE FROM bloqueo_anotacion WHERE ultimo_latido < NOW() - INTERVAL '45 seconds'`);

    const existing = await query<{ user_id: string; user_area: string }>(
      `SELECT b.usuario_id::text AS user_id, ca.nombre_area AS user_area
       FROM bloqueo_anotacion b
       JOIN configuracion_areas ca ON ca.id = b.area_usuario_id
       WHERE b.archivo_id = $1`,
      [id]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      const sameUser = row.user_id === uid;
      if (!sameUser) {
        const other = await query<{ display_name: string; user_area: string }>(
          `SELECT trim(u.nombre || ' ' || u.apellido) AS display_name, ca.nombre_area AS user_area
           FROM bloqueo_anotacion l
           JOIN usuarios u ON u.id = l.usuario_id
           JOIN configuracion_areas ca ON ca.id = l.area_usuario_id
           WHERE l.archivo_id = $1`,
          [id]
        );
        const dn = other.rows[0]?.display_name || 'Otro usuario';
        const oa = other.rows[0]?.user_area || row.user_area;
        if (action === 'acquire') {
          return successResponse({
            ok: false,
            blocked: true,
            message: `Este archivo está siendo anotado por ${dn} (${oa}). Solo puede visualizar y no editar todavía; espere a que la otra área termine de editar.`,
            holderUserId: row.user_id,
            holderArea: oa,
            holderName: dn,
          });
        }
        return successResponse({ ok: false, blocked: true });
      }
    }

    await query(
      `INSERT INTO bloqueo_anotacion (archivo_id, usuario_id, area_usuario_id, ultimo_latido)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (archivo_id) DO UPDATE SET
         usuario_id = EXCLUDED.usuario_id,
         area_usuario_id = EXCLUDED.area_usuario_id,
         ultimo_latido = EXCLUDED.ultimo_latido`,
      [id, uid, areaId]
    );

    return successResponse({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * DELETE /api/files/:id/annotation-lock
 * Libera la sesión de anotación (cerrar visor o terminar).
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    fileIdSchema.parse({ id });

    const fileRow = await FileService.getFileById(id);
    if (!fileRow) {
      throw new ValidationError('Archivo no encontrado');
    }

    await query('DELETE FROM bloqueo_anotacion WHERE archivo_id = $1 AND usuario_id = $2', [id, session.user.id]);
    return successResponse({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
