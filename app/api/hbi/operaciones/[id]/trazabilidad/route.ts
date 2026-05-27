import { requireAuth } from '@/lib/auth/get-session';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { TrazabilidadHbiService } from '@/services/hbi/trazabilidad.service';

export const runtime = 'nodejs';

/** GET /api/hbi/operaciones/:id/trazabilidad — línea de tiempo completa */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await context.params;
    const eventos = await TrazabilidadHbiService.lineaTiempo(id);
    return successResponse({ eventos, total: eventos.length });
  } catch (error) {
    return errorResponse(error);
  }
}
