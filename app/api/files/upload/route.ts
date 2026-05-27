import { NextRequest } from 'next/server';
import { FileService } from '@/services/file.service';
import { uploadFileSchema, MAX_FILE_SIZE } from '@/lib/validations/file.schema';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ForbiddenError, ValidationError } from '@/lib/utils/errors';
import { requireAuth, canInteractWithCase } from '@/lib/auth/get-session';
import { query } from '@/lib/db';
import { casesStateColumn } from '@/lib/db/cases-schema-compat';
import { dbEstadoTramiteToApp } from '@/lib/db/estado-tramite-map';
import { notifyCaseSubscribers } from '@/lib/realtime/case-events';

/**
 * POST /api/files/upload
 * Sube un archivo
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const formData = await request.formData();
    
    const file = formData.get('file') as File;
    const caseId = formData.get('caseId') as string;
    const fileType = formData.get('fileType') as string;
    const description = formData.get('description') as string | undefined;
    const signatureReason = formData.get('signatureReason') as string | undefined;
    const parentFileId = formData.get('parentFileId') as string | undefined;

    if (!file) {
      throw new ValidationError('Archivo no proporcionado');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new ValidationError(`El archivo excede el tamaño máximo de ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    const sc = await casesStateColumn();
    const caseResult = await query<{ created_by: string; current_area_id: number | null; estado: string }>(
      `SELECT t.creado_por AS created_by, t.area_actual_id AS current_area_id, t.${sc} AS estado
       FROM tramites t
       WHERE t.id = $1`,
      [caseId]
    );

    if (caseResult.rows.length === 0) {
      throw new ValidationError('Trámite no encontrado');
    }

    const row = caseResult.rows[0];
    await canInteractWithCase(row.created_by, row.current_area_id ?? undefined);

    const isCreator = session.user.id === row.created_by;
    if (session.user.role === 'AREA_USER' && !isCreator) {
      throw new ForbiddenError(
        'Los usuarios de área no pueden subir archivos salvo en trámites que ellos hayan creado (p. ej. tras una devolución).'
      );
    }

    if (isCreator && dbEstadoTramiteToApp(row.estado) !== 'RETURNED') {
      throw new ForbiddenError(
        'Solo puede agregar archivos cuando el trámite ha sido devuelto para corrección.'
      );
    }

    const validatedData = uploadFileSchema.parse({
      caseId,
      fileName: file.name,
      fileType,
      description: description || undefined,
      signatureReason: signatureReason || undefined,
      parentFileId: parentFileId || undefined,
    });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadedFile = await FileService.uploadFile(
      validatedData,
      session.user.id,
      buffer
    );

    notifyCaseSubscribers(caseId);
    return successResponse(uploadedFile, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
