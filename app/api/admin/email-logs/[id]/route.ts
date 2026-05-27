import { requireRole } from '@/lib/auth/get-session';
import { EmailLogService } from '@/services/email-log.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { NotFoundError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET /api/admin/email-logs/:id — detalle completo con HTML para vista previa */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('ADMIN');
    const { id } = await context.params;
    const log = await EmailLogService.getById(id);
    if (!log) {
      throw new NotFoundError('Correo no encontrado.');
    }
    return successResponse(log);
  } catch (e) {
    return errorResponse(e);
  }
}
