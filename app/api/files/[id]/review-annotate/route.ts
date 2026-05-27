import { NextRequest } from 'next/server';
import { FileService } from '@/services/file.service';
import { fileIdSchema, MAX_FILE_SIZE } from '@/lib/validations/file.schema';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireAuth, assertCanPostFileComment } from '@/lib/auth/get-session';
import { query } from '@/lib/db';
import { ValidationError, ForbiddenError } from '@/lib/utils/errors';
import { casesStateColumn } from '@/lib/db/cases-schema-compat';
import { dbEstadoTramiteToApp } from '@/lib/db/estado-tramite-map';
import { notifyCaseSubscribers } from '@/lib/realtime/case-events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/files/:id/review-annotate
 * Sustituye el archivo en revisión: PDF anotado o documento Word (.doc/.docx) revisado.
 * Mismo criterio de permiso que comentarios por archivo (`assertCanPostFileComment`).
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

    const fileRow = await FileService.getFileById(id);
    if (!fileRow) {
      throw new ValidationError('Archivo no encontrado');
    }

    const sc = await casesStateColumn();
    const caseResult = await query<{ estado: string }>(
      `SELECT ${sc} AS estado FROM tramites WHERE id = $1`,
      [fileRow.caseId]
    );
    if (caseResult.rows.length === 0) {
      throw new ValidationError('Trámite no encontrado');
    }

    const status = dbEstadoTramiteToApp(caseResult.rows[0].estado);
    if (fileRow.isSigned) {
      throw new ForbiddenError('No se pueden guardar anotaciones en documentos firmados');
    }
    if (fileRow.isFinal) {
      throw new ValidationError('No se pueden guardar anotaciones en este tipo de archivo');
    }

    await assertCanPostFileComment(session.user, fileRow.caseId, status);

    const nombreOrigen = fileRow.fileName.toLowerCase();
    const nombreSubida = (file.name || fileRow.fileName).toLowerCase();
    const esWord = (n: string) => n.endsWith('.doc') || n.endsWith('.docx');
    const esPdf = (n: string) => n.endsWith('.pdf');
    if (esPdf(nombreOrigen) && !esPdf(nombreSubida)) {
      throw new ValidationError('Este registro es un PDF: suba un archivo .pdf.');
    }
    if (esWord(nombreOrigen) && !esWord(nombreSubida)) {
      throw new ValidationError('Este registro es Word: suba un archivo .doc o .docx.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const updated = await FileService.replaceReviewerAnnotatedPdf(
      id,
      session.user.id,
      buffer,
      file.name || fileRow.fileName
    );
    notifyCaseSubscribers(updated.caseId);
    return successResponse(updated, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
