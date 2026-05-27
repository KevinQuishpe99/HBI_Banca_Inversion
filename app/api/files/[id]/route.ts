import { NextRequest, NextResponse } from 'next/server';
import { FileService } from '@/services/file.service';
import { getBlobStorage } from '@/lib/azure/blob-storage';
import { requireAuth, canAccessCase } from '@/lib/auth/get-session';
import { query, transaction } from '@/lib/db';
import { casesStateColumn, getCasesStateSql } from '@/lib/db/cases-schema-compat';
import { dbEstadoTramiteToApp } from '@/lib/db/estado-tramite-map';
import { errorResponse, successResponse } from '@/lib/utils/response';
import { fileIdSchema } from '@/lib/validations/file.schema';
import { ForbiddenError, ValidationError } from '@/lib/utils/errors';
import { isUserSupervisorForArea } from '@/lib/auth/area-supervisor';
import { getAreaRowFlagsById, isLegalSigningSemantics } from '@/lib/db/area-session-flags';
import { notifyCaseSubscribers } from '@/lib/realtime/case-events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Usuario de área Legal / Director (firma o cierre). */
function isSigningOrCloseAreaUser(u: {
  role?: string;
  isSigningArea?: boolean;
  isFinalStepArea?: boolean;
  puedeCompletarTramite?: boolean;
}): boolean {
  return (
    u.role === 'AREA_USER' &&
    (u.isSigningArea === true || u.isFinalStepArea === true || u.puedeCompletarTramite === true)
  );
}

/** Firmante habilitado en Legal o Director (descarga para revisar / firmar). */
function isSignerForDownload(u: {
  role?: string;
  canSign?: boolean;
  isSigningArea?: boolean;
  isFinalStepArea?: boolean;
  puedeCompletarTramite?: boolean;
}): boolean {
  return isSigningOrCloseAreaUser(u) && u.canSign === true;
}

/**
 * GET /api/files/:id
 * Sirve el contenido del archivo (inline para previsualización o attachment para descarga).
 * Requiere sesión y acceso al trámite asociado.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    fileIdSchema.parse({ id });

    const file = await FileService.getFileById(id);
    if (!file) {
      throw new ValidationError('Archivo no encontrado');
    }

    const caseResult = await query<{ created_by: string; current_area_id: number | null }>(
      `SELECT t.creado_por AS created_by, ca.id AS current_area_id
       FROM tramites t
       LEFT JOIN configuracion_areas ca ON ca.id = t.area_actual_id
       WHERE t.id = $1`,
      [file.caseId]
    );
    if (caseResult.rows.length === 0) {
      throw new ValidationError('Trámite no encontrado');
    }
    await canAccessCase(caseResult.rows[0].created_by, caseResult.rows[0].current_area_id ?? undefined);

    const mime = file.mimeType || 'application/octet-stream';
    const download = request.nextUrl.searchParams.get('download') === '1';
    if (download) {
      const role = session.user.role;
      const u = session.user;
      const createdBy = caseResult.rows[0].created_by;
      let canDownload = role === 'ADMIN';

      if (file.isSigned) {
        if (!canDownload && u.id === createdBy) {
          canDownload = true;
        }
        if (!canDownload && isSignerForDownload(u)) {
          canDownload = true;
        }
      } else if (!canDownload && role === 'AREA_USER' && u.areaId != null) {
        if (isSignerForDownload(u)) {
          canDownload = true;
        }
        if (!canDownload && isSigningOrCloseAreaUser(u)) {
          canDownload = await isUserSupervisorForArea(u.id, u.areaId);
        }
      }

      if (!canDownload) {
        throw new ForbiddenError(
          file.isSigned
            ? 'Solo el creador del trámite, quienes tienen firma habilitada en Legal o Director, o un administrador pueden descargar la copia firmada. Use la vista previa (ojo) para revisar.'
            : 'Solo el supervisor titular de Legal o Director, quienes tienen firma habilitada en esas áreas, o un administrador pueden descargar el archivo base. Use la vista previa (ojo) para revisar.'
        );
      }
    }

    const blobStorage = getBlobStorage();
    const buffer = await blobStorage.downloadFile(file.blobPath);
    const disposition = download ? 'attachment' : 'inline';
    const encodedName = encodeURIComponent(file.fileName);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Length': String(buffer.length),
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodedName}`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * DELETE /api/files/:id
 * Marca el archivo como eliminado (soft delete). Requiere poder interactuar con el trámite.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    fileIdSchema.parse({ id });

    const file = await FileService.getFileById(id);
    if (!file) {
      throw new ValidationError('Archivo no encontrado');
    }

    const sc = await casesStateColumn();
    const caseResult = await query<{
      created_by: string;
      current_area_id: number | null;
      estado: string;
      return_allow_file_update: boolean | null;
    }>(
      `SELECT t.creado_por AS created_by, ca.id AS current_area_id, t.${sc} AS estado,
              COALESCE(t.permite_actualizacion_devolucion, false) AS return_allow_file_update
       FROM tramites t
       LEFT JOIN configuracion_areas ca ON ca.id = t.area_actual_id
       WHERE t.id = $1`,
      [file.caseId]
    );
    if (caseResult.rows.length === 0) {
      throw new ValidationError('Trámite no encontrado');
    }

    const c = caseResult.rows[0];
    const isDirectorGeneral =
      session.user.role === 'AREA_USER' && session.user.puedeCompletarTramite === true;
    const isLegalWithSign =
      session.user.role === 'AREA_USER' &&
      session.user.isSigningArea === true &&
      session.user.canSign === true;

    let signRequiredAreaId: number | null = null;
    if (file.isSigned && file.signedSourceFileId) {
      const signMeta = await query<{ required_by_area_id: number }>(
        `SELECT ca.id AS required_by_area_id
         FROM archivos_por_firmar apf
         JOIN configuracion_areas ca ON ca.id = apf.area_requerida_id
         WHERE apf.tramite_id = $1 AND apf.archivo_id = $2`,
        [file.caseId, file.signedSourceFileId]
      );
      signRequiredAreaId = signMeta.rows[0]?.required_by_area_id ?? null;
    }

    const signRequiredFlags =
      signRequiredAreaId != null ? await getAreaRowFlagsById(signRequiredAreaId) : null;
    const requiredIsLegalSigning =
      signRequiredFlags != null && isLegalSigningSemantics(signRequiredFlags);

    const canDeleteSignedFile =
      session.user.role === 'ADMIN' ||
      isDirectorGeneral ||
      (isLegalWithSign &&
        requiredIsLegalSigning &&
        signRequiredAreaId != null &&
        session.user.areaId === signRequiredAreaId);

    if (file.isSigned && !canDeleteSignedFile) {
      throw new ForbiddenError(
        'Solo quien corresponde por área (p. ej. Legal para firma legal, Director General para firma del director) o un administrador puede eliminar archivos firmados'
      );
    }

    if (!(file.isSigned && canDeleteSignedFile)) {
      await canAccessCase(c.created_by, c.current_area_id ?? undefined);
      const userInLegalOrDgLike =
        session.user.role === 'AREA_USER' &&
        (session.user.isSigningArea === true || session.user.puedeCompletarTramite === true);
      if (
        session.user.id !== c.created_by &&
        session.user.role === 'AREA_USER' &&
        !userInLegalOrDgLike
      ) {
        throw new ForbiddenError(
          'Solo las áreas Legal y Director General pueden eliminar archivos de este trámite.'
        );
      }
    }

    if (file.isCreationUpload) {
      throw new ForbiddenError(
        'No se puede eliminar un archivo subido al crear el trámite. Puede agregar otros documentos o actualizar la información del trámite.'
      );
    }

    if (session.user.id === c.created_by) {
      if (dbEstadoTramiteToApp(c.estado) === 'RETURNED') {
        // Creador en estado devuelto: puede corregir archivos (agregar, sustituir y eliminar) antes de reenviar.
      } else if (file.isSigned && canDeleteSignedFile) {
        /* permitido: Legal/Director/Admin pueden quitar una copia firmada aunque el caso esté en revisión */
      } else {
        throw new ForbiddenError(
          'No puede eliminar archivos mientras el trámite está en revisión. Solo cuando el trámite está devuelto.'
        );
      }
    }

    await transaction(async (client) => {
      const { column: stCol, fr } = await getCasesStateSql();
      await client.query(
        `UPDATE archivos
         SET eliminado = true, eliminado_en = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id]
      );

      if (file.isSigned && file.signedSourceFileId) {
        await client.query(
          `UPDATE archivos_por_firmar
           SET firmado = false
           WHERE tramite_id = $1 AND archivo_id = $2`,
          [file.caseId, file.signedSourceFileId]
        );

        let areaToReopenId = signRequiredAreaId;
        if (areaToReopenId == null) {
          const dg = await client.query<{ id: number }>(
            `SELECT id FROM configuracion_areas WHERE puede_completar_tramite = true ORDER BY id LIMIT 1`
          );
          areaToReopenId = dg.rows[0]?.id ?? null;
        }
        if (areaToReopenId != null) {
          await client.query(
            `DELETE FROM tramite_areas_aprobadas
             WHERE tramite_id = $1 AND area_id = $2`,
            [file.caseId, areaToReopenId]
          );
        }

        await client.query(
          `UPDATE tramites
           SET ${stCol} = ${fr.revisado}, completado_en = NULL
           WHERE id = $1 AND ${stCol} = ${fr.tramiteCompletado}`,
          [file.caseId]
        );
      }
    });
    notifyCaseSubscribers(file.caseId);
    return successResponse({ message: 'Archivo eliminado' });
  } catch (error) {
    return errorResponse(error);
  }
}
