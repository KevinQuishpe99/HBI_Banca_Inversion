import { NextRequest } from 'next/server';
import { FlowService } from '@/services/flow.service';
import { legalCompleteEarlySchema } from '@/lib/validations/flow.schema';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireAuth } from '@/lib/auth/get-session';
import { notifyCaseSubscribers } from '@/lib/realtime/case-events';

/**
 * POST /api/flow/legal-complete
 * Legal da el trámite por completado sin pasar por Director General.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const validatedData = legalCompleteEarlySchema.parse(body);

    await FlowService.completeCaseLegalEarly(
      validatedData.caseId,
      session.user.id,
      session.user.role,
      session.user.areaId,
      validatedData.comments
    );

    notifyCaseSubscribers(validatedData.caseId);
    return successResponse({ message: 'Trámite completado por Legal' });
  } catch (error) {
    return errorResponse(error);
  }
}
