import { NextRequest } from 'next/server';
import { fileIdSchema, fileCommentBodySchema } from '@/lib/validations/file.schema';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireAuth, assertCanPostFileComment } from '@/lib/auth/get-session';
import { query } from '@/lib/db';
import { FileService } from '@/services/file.service';
import { FileCommentService } from '@/services/file-comment.service';
import { ForbiddenError, ValidationError } from '@/lib/utils/errors';
import { casesStateColumn } from '@/lib/db/cases-schema-compat';
import { dbEstadoTramiteToApp } from '@/lib/db/estado-tramite-map';
import { notifyCaseSubscribers } from '@/lib/realtime/case-events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/files/:id/comments
 * Comentario de revisión sobre un archivo concreto (área asignada o admin).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    fileIdSchema.parse({ id });

    const body = await request.json();
    const { content } = fileCommentBodySchema.parse(body);

    const file = await FileService.getFileById(id);
    if (!file) {
      throw new ValidationError('Archivo no encontrado');
    }

    const sc = await casesStateColumn();
    const caseResult = await query<{
      created_by: string;
      current_area_id: number | null;
      estado: string;
    }>(
      `SELECT t.creado_por AS created_by, ca.id AS current_area_id, t.${sc} AS estado
       FROM tramites t
       LEFT JOIN configuracion_areas ca ON ca.id = t.area_actual_id
       WHERE t.id = $1`,
      [file.caseId]
    );

    if (caseResult.rows.length === 0) {
      throw new ValidationError('Trámite no encontrado');
    }

    const c = caseResult.rows[0];
    const isDirectorOrAdmin =
      session.user.role === 'ADMIN' ||
      (session.user.role === 'AREA_USER' && session.user.puedeCompletarTramite === true);

    if (file.isSigned) {
      if (!isDirectorOrAdmin) {
        throw new ForbiddenError('Solo Director General o administrador pueden comentar documentos firmados');
      }
    } else {
      await assertCanPostFileComment(session.user, file.caseId, dbEstadoTramiteToApp(c.estado));
    }

    await FileCommentService.create(
      id,
      file.caseId,
      session.user.id,
      session.user.areaId,
      content
    );

    notifyCaseSubscribers(file.caseId);
    return successResponse({ message: 'Comentario registrado' }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
