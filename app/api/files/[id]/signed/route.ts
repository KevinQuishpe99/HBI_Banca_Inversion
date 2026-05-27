import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/get-session';
import { fileIdSchema, MAX_FILE_SIZE, isAllowedSignedDocumentFileName } from '@/lib/validations/file.schema';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { FileService } from '@/services/file.service';
import { query } from '@/lib/db';
import { ForbiddenError, ValidationError } from '@/lib/utils/errors';
import { notifyCaseSubscribers } from '@/lib/realtime/case-events';

export const dynamic = 'force-dynamic';

/**
 * POST /api/files/:id/signed
 * Sube la copia firmada (PDF o Word .doc/.docx) y marca `archivos_por_firmar.firmado`.
 * No modifica pasos del workflow ni el estado del trámite (eso va por Acciones de revisión).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    fileIdSchema.parse({ id });

    const user = session.user;
    const canSignUser =
      user.role === 'ADMIN' ||
      (user.role === 'AREA_USER' &&
        user.canSign === true &&
        (user.isSigningArea === true || user.puedeCompletarTramite === true));
    if (!canSignUser) {
      throw new ForbiddenError(
        'Solo Legal o Director General con firma habilitada (o administrador) pueden subir documentos firmados'
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      throw new ValidationError('Archivo firmado no proporcionado');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new ValidationError(
        `El archivo excede el tamaño máximo de ${MAX_FILE_SIZE / 1024 / 1024}MB`
      );
    }

    if (!isAllowedSignedDocumentFileName(file.name || '')) {
      throw new ValidationError(
        'Solo se aceptan documentos firmados en PDF o Word (.doc, .docx). Compruebe la extensión del archivo.'
      );
    }

    const original = await FileService.getFileById(id);
    if (!original) {
      throw new ValidationError('Archivo original no encontrado');
    }

    const checkToSign = await query<{ is_signed: boolean; required_by_area_id: number }>(
      `SELECT apf.firmado AS is_signed, ca.id AS required_by_area_id
       FROM archivos_por_firmar apf
       JOIN configuracion_areas ca ON ca.id = apf.area_requerida_id
       WHERE apf.tramite_id = $1 AND apf.archivo_id = $2`,
      [original.caseId, original.id]
    );
    if (checkToSign.rows.length === 0) {
      throw new ValidationError('Este archivo no está marcado para firma');
    }
    const requiredByAreaId = checkToSign.rows[0].required_by_area_id;
    const isAllowedByArea =
      user.role === 'ADMIN' ||
      (user.role === 'AREA_USER' &&
        user.areaId === requiredByAreaId &&
        user.canSign === true);
    if (!isAllowedByArea) {
      throw new ForbiddenError('Este archivo debe ser firmado por otra área');
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const signedFile = await FileService.uploadFinalFile(
      original.caseId,
      file.name,
      buffer,
      user.id,
      original.id
    );

    await query(
      `UPDATE archivos_por_firmar
       SET firmado = true
       WHERE tramite_id = $1 AND archivo_id = $2`,
      [original.caseId, original.id]
    );

    notifyCaseSubscribers(original.caseId);
    return successResponse(signedFile, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
