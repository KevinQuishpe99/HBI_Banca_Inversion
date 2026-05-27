import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/get-session';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { CorreoEnviadoHbiService } from '@/services/hbi/correo-enviado.service';
import { OperacionService } from '@/services/hbi/operacion.service';
import { NotFoundError } from '@/lib/utils/errors';
import { enviarCorreoHbiSchema } from '@/lib/validations/hbi-correo-enviar.schema';

export const runtime = 'nodejs';

/** GET — historial de correos enviados de la operación */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await context.params;
    const items = await CorreoEnviadoHbiService.listar(id);
    return successResponse({ items, total: items.length });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST — enviar correo y registrar en historial + trazabilidad */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;
    const body = enviarCorreoHbiSchema.parse(await request.json());

    const op = await OperacionService.obtenerPorId(id);
    if (!op) throw new NotFoundError('Operación no encontrada');

    const result = await CorreoEnviadoHbiService.enviarDesdeOperacion({
      operacionId: id,
      codigoOperacion: op.codigoOperacion,
      destinatarioEmail: body.destinatarioEmail,
      asunto: body.asunto,
      cuerpoTexto: body.cuerpoTexto,
      usuarioId: session.user.id,
      origen: body.origen,
    });

    return successResponse(result, result.graphOk ? 201 : 200);
  } catch (error) {
    return errorResponse(error);
  }
}
