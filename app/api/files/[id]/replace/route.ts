import { NextRequest } from 'next/server';
import { FileService } from '@/services/file.service';
import { fileIdSchema, MAX_FILE_SIZE } from '@/lib/validations/file.schema';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireAuth } from '@/lib/auth/get-session';
import { ValidationError } from '@/lib/utils/errors';
import { notifyCaseSubscribers } from '@/lib/realtime/case-events';

export const dynamic = 'force-dynamic';

/**
 * POST /api/files/:id/replace
 * Sustituye el binario del archivo conservando id (comentarios y firma pendiente siguen asociados).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    fileIdSchema.parse({ id });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file?.size) {
      throw new ValidationError('Archivo no proporcionado');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new ValidationError(`El archivo excede el tamaño máximo de ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const updated = await FileService.replaceFileContent(id, session.user.id, buffer, file.name);
    notifyCaseSubscribers(updated.caseId);
    return successResponse(updated, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
