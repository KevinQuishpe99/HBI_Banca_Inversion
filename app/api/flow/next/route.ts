import { NextRequest } from 'next/server';
import { FlowService } from '@/services/flow.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireAuth, canAccessCase } from '@/lib/auth/get-session';
import { query } from '@/lib/db';

/**
 * POST /api/flow/next
 * Obtiene el progreso del workflow de un trámite
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { caseId } = body;

    const caseResult = await query<{ created_by: string; current_area_id: number | null }>(
      `SELECT t.creado_por AS created_by, t.area_actual_id AS current_area_id
       FROM tramites t
       WHERE t.id = $1`,
      [caseId]
    );

    if (caseResult.rows.length > 0) {
      await canAccessCase(
        caseResult.rows[0].created_by,
        caseResult.rows[0].current_area_id ?? undefined
      );
    }

    const progress = await FlowService.getWorkflowProgress(caseId);
    return successResponse(progress);
  } catch (error) {
    return errorResponse(error);
  }
}
