import { NextRequest } from 'next/server';
import { HistoryService } from '@/services/history.service';
import { caseIdSchema } from '@/lib/validations/case.schema';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireAuth, canAccessCase } from '@/lib/auth/get-session';
import { query } from '@/lib/db';

/**
 * GET /api/cases/:id/history
 * Obtiene el historial completo de un trámite
 */
export async function GET(
  request: NextRequest,
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

    if (caseResult.rows.length > 0) {
      await canAccessCase(
        caseResult.rows[0].created_by,
        caseResult.rows[0].current_area_id ?? undefined
      );
    }

    const history = await HistoryService.getCaseHistory(id);
    const comments = await HistoryService.getCaseComments(id);

    return successResponse({
      history,
      comments,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
