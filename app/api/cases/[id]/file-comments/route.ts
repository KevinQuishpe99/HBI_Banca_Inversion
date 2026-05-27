import { NextRequest } from 'next/server';
import { caseIdSchema } from '@/lib/validations/case.schema';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireAuth, canAccessCase } from '@/lib/auth/get-session';
import { query } from '@/lib/db';
import { FileCommentService } from '@/services/file-comment.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cases/:id/file-comments
 * Comentarios por archivo del trámite (lectura para quien puede ver el trámite).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      return successResponse([]);
    }
    await canAccessCase(
      caseResult.rows[0].created_by,
      caseResult.rows[0].current_area_id ?? undefined
    );

    const rows = await FileCommentService.listByCase(id);
    return successResponse(rows);
  } catch (error) {
    return errorResponse(error);
  }
}
