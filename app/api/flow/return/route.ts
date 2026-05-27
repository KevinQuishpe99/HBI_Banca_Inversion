import { NextRequest } from 'next/server';
import { FlowService } from '@/services/flow.service';
import { returnCaseSchema } from '@/lib/validations/flow.schema';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireAuth } from '@/lib/auth/get-session';
import { ForbiddenError } from '@/lib/utils/errors';
import { notifyCaseSubscribers } from '@/lib/realtime/case-events';

/**
 * POST /api/flow/return
 * Devuelve un trámite al usuario para correcciones
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const validatedData = returnCaseSchema.parse(body);

    if (
      validatedData.variant === 'legal' &&
      session.user.role !== 'ADMIN' &&
      !session.user.isSigningArea &&
      !session.user.isFinalStepArea
    ) {
      throw new ForbiddenError(
        'Solo áreas de firma, paso final o Admin pueden usar el formulario de devolución extendido'
      );
    }

    const payload =
      validatedData.variant === 'legal'
        ? {
            variant: 'legal' as const,
            legalObservations: validatedData.legalObservations ?? '',
            legalClientRecommendations: validatedData.legalClientRecommendations ?? '',
            legalScheduleMeeting: validatedData.legalScheduleMeeting ?? false,
          }
        : {
            variant: 'standard' as const,
            comments: validatedData.comments ?? '',
          };

    await FlowService.returnCase(
      validatedData.caseId,
      session.user.id,
      session.user.role,
      session.user.areaId,
      validatedData.returnReason,
      validatedData.allowFileUpdate ?? false,
      payload
    );

    notifyCaseSubscribers(validatedData.caseId);
    return successResponse({ message: 'Trámite devuelto para correcciones' });
  } catch (error) {
    return errorResponse(error);
  }
}
