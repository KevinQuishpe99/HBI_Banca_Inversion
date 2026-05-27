import { requireAuth } from '@/lib/auth/get-session';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ActividadHbiService } from '@/services/hbi/actividad.service';
import { actualizarActividadEstadoSchema } from '@/lib/validations/hbi-operacion.schema';

export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; actividadId: string }> }
) {
  try {
    const session = await requireAuth();
    const { id, actividadId } = await context.params;
    const body = actualizarActividadEstadoSchema.parse(await request.json());
    const act = await ActividadHbiService.actualizarEstado(
      actividadId,
      id,
      body.estado,
      session.user.id
    );
    return successResponse(act);
  } catch (error) {
    return errorResponse(error);
  }
}
