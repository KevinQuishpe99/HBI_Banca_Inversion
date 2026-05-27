import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/get-session';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { DocumentoHbiService } from '@/services/hbi/documento.service';
import { NotFoundError } from '@/lib/utils/errors';
import { OperacionService } from '@/services/hbi/operacion.service';
import type { TipoDocumentoContractual } from '@/types/hbi/operacion.types';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await context.params;
    const docs = await DocumentoHbiService.listar(id);
    return successResponse(docs);
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
    const op = await OperacionService.obtenerPorId(id);
    if (!op) throw new NotFoundError('Operación no encontrada');

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return errorResponse(new Error('Debe enviar un archivo en el campo "file"'));
    }

    const tipoManual = form.get('tipoDocumento') as TipoDocumentoContractual | null;
    const buffer = Buffer.from(await file.arrayBuffer());

    const doc = await DocumentoHbiService.subir({
      operacionId: id,
      fileName: file.name,
      buffer,
      mimeType: file.type || undefined,
      tipoManual: tipoManual ?? undefined,
      usuarioId: session.user.id,
    });

    return successResponse(doc, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
