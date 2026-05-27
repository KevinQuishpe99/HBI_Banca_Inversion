import { requireAuth } from '@/lib/auth/get-session';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { MotorOperativoService } from '@/services/hbi/motor-operativo.service';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await context.params;
    const estado = await MotorOperativoService.calcularEstadoIntegral(id);
    return successResponse(estado);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await context.params;
    await MotorOperativoService.sincronizarOperacion(id);
    const estado = await MotorOperativoService.calcularEstadoIntegral(id);
    return successResponse(estado);
  } catch (error) {
    return errorResponse(error);
  }
}
