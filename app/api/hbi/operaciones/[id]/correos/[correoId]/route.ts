import { requireAuth } from '@/lib/auth/get-session';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { CorreoHbiService } from '@/services/hbi/correo.service';

export const runtime = 'nodejs';

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ id: string; correoId: string }> }
) {
  try {
    await requireAuth();
    const { id, correoId } = await context.params;
    await CorreoHbiService.marcarLeido(correoId, id);
    return successResponse({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
