import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/get-session';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ActividadHbiService } from '@/services/hbi/actividad.service';
import { crearActividadSchema } from '@/lib/validations/hbi-operacion.schema';
import type { TipoServicioHbi } from '@/types/hbi/operacion.types';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await context.params;
    const tipo = request.nextUrl.searchParams.get('tipoServicio') as TipoServicioHbi | null;
    return successResponse(await ActividadHbiService.listar(id, tipo ?? undefined));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;
    const body = crearActividadSchema.parse(await request.json());
    const act = await ActividadHbiService.crear({
      operacionId: id,
      tipoServicio: body.tipoServicio,
      titulo: body.titulo,
      descripcion: body.descripcion,
      fechaLimite: body.fechaLimite,
      asignadoA: body.asignadoA,
      usuarioId: session.user.id,
    });
    return successResponse(act, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
