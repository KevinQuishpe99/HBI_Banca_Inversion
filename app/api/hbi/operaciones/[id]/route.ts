import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/get-session';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { OperacionService } from '@/services/hbi/operacion.service';
import { NotFoundError } from '@/lib/utils/errors';

export const runtime = 'nodejs';

/** GET /api/hbi/operaciones/:id — detalle o vista 360 (?vista360=true) */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await context.params;
    const vista360 = request.nextUrl.searchParams.get('vista360') === 'true';

    if (vista360) {
      const data = await OperacionService.vista360(id);
      if (!data) throw new NotFoundError('Operación no encontrada');
      return successResponse(data);
    }

    const operacion = await OperacionService.obtenerPorId(id);
    if (!operacion) throw new NotFoundError('Operación no encontrada');
    return successResponse(operacion);
  } catch (error) {
    return errorResponse(error);
  }
}
