import { NextRequest } from 'next/server';
import { FlowService } from '@/services/flow.service';
import { approveStepSchema } from '@/lib/validations/flow.schema';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireAuth } from '@/lib/auth/get-session';
import { notifyCaseSubscribers } from '@/lib/realtime/case-events';

/**
 * POST /api/flow/approve
 * Aprueba el paso actual del workflow
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const validatedData = approveStepSchema.parse(body);

    await FlowService.approveStep(
      validatedData.caseId,
      session.user.id,
      session.user.role,
      session.user.areaId,
      validatedData.comments
    );

    notifyCaseSubscribers(validatedData.caseId);
    return successResponse({ message: 'Paso aprobado exitosamente' });
  } catch (error) {
    return errorResponse(error);
  }
}
