import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireAuth, canAccessCase } from '@/lib/auth/get-session';
import { query } from '@/lib/db';
import { casesStateColumn } from '@/lib/db/cases-schema-compat';
import { dbEstadoTramiteToApp } from '@/lib/db/estado-tramite-map';
import { z } from 'zod';
import { caseIdSchema } from '@/lib/validations/case.schema';
import { ValidationError, ForbiddenError } from '@/lib/utils/errors';
import { notifyCaseSubscribers } from '@/lib/realtime/case-events';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  fileId: z.string().uuid(),
  shouldSign: z.boolean(),
  signerArea: z.enum(['LEGAL', 'DIRECTOR_GENERAL']).optional(),
});

/** Resuelve el id de área para firma sin columna `codigo` (roles fijos de la UI). */
async function resolveSignerAreaId(signer: 'LEGAL' | 'DIRECTOR_GENERAL'): Promise<number> {
  if (signer === 'DIRECTOR_GENERAL') {
    const r = await query<{ id: number }>(
      `SELECT id FROM configuracion_areas
       WHERE activo = true AND puede_completar_tramite = true
       ORDER BY orden ASC LIMIT 1`
    );
    const id = r.rows[0]?.id;
    if (id == null) throw new ValidationError('No hay área de Director General configurada');
    return id;
  }
  const r = await query<{ id: number }>(
    `SELECT id FROM configuracion_areas
     WHERE activo = true AND permite_firma = true
     ORDER BY orden ASC LIMIT 1`
  );
  const id = r.rows[0]?.id;
  if (id == null) {
    throw new ValidationError(
      'No hay ningún área activa con «firma de documentos» (Firma doc.). En Administración → Configuración de áreas, marque Firma doc. en el área que firma (p. ej. Legal), Activa y Guardar. Puede combinar Firma doc. y Cierra trám. en la misma fila si quien firma también cierra el trámite. El permiso «Puede firmar» en usuarios no sustituye marcar Firma doc. aquí.'
    );
  }
  return id;
}

/** Si un área tiene firma y cierre, preferimos etiqueta LEGAL (mismo id de área en ambos flujos). */
const REQUIRED_BY_AREA_EXPR = `CASE
  WHEN ca.permite_firma = true THEN 'LEGAL'
  WHEN ca.puede_completar_tramite = true THEN 'DIRECTOR_GENERAL'
  ELSE ca.id::text
END AS required_by_area`;

/**
 * GET /api/cases/:id/files-to-sign
 * Lista archivos marcados para firma de director en un trámite.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    caseIdSchema.parse({ id });

    const caseResult = await query<{ created_by: string; current_area_id: number | null }>(
      `SELECT t.creado_por AS created_by, t.area_actual_id AS current_area_id
       FROM tramites t
       WHERE t.id = $1`,
      [id]
    );
    if (caseResult.rows.length === 0) {
      return successResponse([]);
    }
    await canAccessCase(caseResult.rows[0].created_by, caseResult.rows[0].current_area_id ?? undefined);

    const rows = await query<{
      id: string;
      file_id: string;
      is_signed: boolean;
      required_by_area: string;
    }>(
      `SELECT apf.id, apf.archivo_id AS file_id, apf.firmado AS is_signed,
              ${REQUIRED_BY_AREA_EXPR}
       FROM archivos_por_firmar apf
       JOIN configuracion_areas ca ON ca.id = apf.area_requerida_id
       WHERE apf.tramite_id = $1`,
      [id]
    );

    return successResponse(
      rows.rows.map((r) => ({
        id: r.id,
        fileId: r.file_id,
        isSigned: r.is_signed,
        requiredByArea: r.required_by_area as 'LEGAL' | 'DIRECTOR_GENERAL',
      }))
    );
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/cases/:id/files-to-sign
 * Marca o desmarca un archivo para firma (Legal, Director General o Admin).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    caseIdSchema.parse({ id });

    const body = await request.json();
    const { fileId, shouldSign, signerArea } = bodySchema.parse(body);

    const user = session.user;
    const isAdmin = user.role === 'ADMIN';
    const isLegalAreaUser = user.role === 'AREA_USER' && !!user.isSigningArea;
    const isDirectorAreaUser = user.role === 'AREA_USER' && !!user.isFinalStepArea;
    if (!isAdmin && !isLegalAreaUser && !isDirectorAreaUser) {
      throw new ForbiddenError(
        'Solo Legal, Director General o un administrador pueden marcar o cambiar quién firma'
      );
    }

    const sc = await casesStateColumn();
    const caseResult = await query<{ created_by: string; estado: string }>(
      `SELECT creado_por AS created_by, ${sc} AS estado FROM tramites WHERE id = $1`,
      [id]
    );
    if (caseResult.rows.length === 0) {
      throw new ValidationError('Trámite no encontrado');
    }

    const caseStatus = caseResult.rows[0].estado;
    if (dbEstadoTramiteToApp(caseStatus) !== 'IN_REVIEW') {
      throw new ValidationError('Solo se pueden marcar archivos para firma cuando el trámite está en revisión');
    }

    if (shouldSign) {
      const targetSignerArea = signerArea ?? 'DIRECTOR_GENERAL';
      const areaReqId = await resolveSignerAreaId(targetSignerArea);
      await query(
        `INSERT INTO archivos_por_firmar (tramite_id, archivo_id, area_requerida_id, firmado)
         VALUES ($1, $2, $3, false)
         ON CONFLICT (tramite_id, archivo_id) DO UPDATE
           SET area_requerida_id = EXCLUDED.area_requerida_id`,
        [id, fileId, areaReqId]
      );
    } else {
      await query(
        `DELETE FROM archivos_por_firmar
         WHERE tramite_id = $1 AND archivo_id = $2 AND firmado = false`,
        [id, fileId]
      );
    }

    const rows = await query<{
      id: string;
      file_id: string;
      is_signed: boolean;
      required_by_area: string;
    }>(
      `SELECT apf.id, apf.archivo_id AS file_id, apf.firmado AS is_signed,
              ${REQUIRED_BY_AREA_EXPR}
       FROM archivos_por_firmar apf
       JOIN configuracion_areas ca ON ca.id = apf.area_requerida_id
       WHERE apf.tramite_id = $1`,
      [id]
    );

    notifyCaseSubscribers(id);
    return successResponse(
      rows.rows.map((r) => ({
        id: r.id,
        fileId: r.file_id,
        isSigned: r.is_signed,
        requiredByArea: r.required_by_area as 'LEGAL' | 'DIRECTOR_GENERAL',
      }))
    );
  } catch (error) {
    return errorResponse(error);
  }
}
