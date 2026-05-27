import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/get-session';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { CorreoHbiService } from '@/services/hbi/correo.service';
import { registrarCorreoSchema } from '@/lib/validations/hbi-operacion.schema';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await context.params;
    return successResponse(await CorreoHbiService.listar(id));
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
    const body = registrarCorreoSchema.parse(await request.json());
    const correo = await CorreoHbiService.registrar({
      operacionId: id,
      remitente: body.remitente,
      asunto: body.asunto,
      cuerpoResumen: body.cuerpoResumen,
      origen: body.origen,
      prioridad: body.prioridad,
      usuarioId: session.user.id,
    });
    return successResponse(correo, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
