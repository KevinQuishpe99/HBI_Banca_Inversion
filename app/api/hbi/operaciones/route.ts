import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/get-session';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { OperacionService } from '@/services/hbi/operacion.service';
import { crearOperacionSchema } from '@/lib/validations/hbi-operacion.schema';
import type { FaseWorkflowHbi } from '@/types/hbi/operacion.types';

export const runtime = 'nodejs';

/** GET /api/hbi/operaciones — listado de operaciones/créditos HBI */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const fase = request.nextUrl.searchParams.get('fase') as FaseWorkflowHbi | null;
    const items = await OperacionService.listar(fase ?? undefined);
    return successResponse(items);
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/hbi/operaciones — nueva operación (Fase 1) */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = crearOperacionSchema.parse(await request.json());
    const operacion = await OperacionService.crear({
      nombreCredito: body.nombreCredito,
      descripcion: body.descripcion,
      deudor: body.deudor,
      serviciosActivos: body.serviciosActivos,
      creadoPor: session.user.id,
      responsableId: body.responsableId,
    });
    return successResponse(operacion, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
