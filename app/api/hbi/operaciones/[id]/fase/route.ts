import { requireAuth } from '@/lib/auth/get-session';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { OperacionService } from '@/services/hbi/operacion.service';
import { avanzarFaseSchema } from '@/lib/validations/hbi-operacion.schema';
import { NotFoundError } from '@/lib/utils/errors';

export const runtime = 'nodejs';

/** PATCH /api/hbi/operaciones/:id/fase — avanzar fase del workflow */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;
    const body = avanzarFaseSchema.parse(await request.json());

    const operacion = await OperacionService.avanzarFase(
      id,
      body.fase,
      session.user.id,
      body.comentario
    );
    if (!operacion) throw new NotFoundError('Operación no encontrada');
    return successResponse(operacion);
  } catch (error) {
    return errorResponse(error);
  }
}
