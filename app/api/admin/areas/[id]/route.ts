import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireRole } from '@/lib/auth/get-session';
import { ValidationError, NotFoundError } from '@/lib/utils/errors';

/**
 * DELETE /api/admin/areas/:id
 * Elimina un área solo si no hay dependencias (usuarios, trámites, enrutamiento, etc.).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('ADMIN');
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (!Number.isFinite(id) || id < 1) {
      throw new ValidationError('Identificador de área inválido');
    }

    const exists = await query(`SELECT 1 FROM configuracion_areas WHERE id = $1 LIMIT 1`, [id]);
    if (exists.rows.length === 0) {
      throw new NotFoundError('Área no encontrada');
    }

    const users = await query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM usuarios WHERE area_id = $1`,
      [id]
    );
    if (parseInt(users.rows[0]?.c ?? '0', 10) > 0) {
      throw new ValidationError(
        'No se puede eliminar: hay usuarios asignados a esta área. Reasígnelos en Gestión de usuarios.'
      );
    }

    const enr = await query(
      `SELECT 1 FROM enrutamiento_area_creador
       WHERE area_creador_id = $1 OR area_supervision_id = $1
       LIMIT 1`,
      [id]
    );
    if (enr.rows.length > 0) {
      throw new ValidationError(
        'No se puede eliminar: el área está en la configuración de flujos (Administración → Flujos).'
      );
    }

    const tramites = await query(
      `SELECT 1 FROM tramites
       WHERE area_actual_id = $1
          OR area_creador_id = $1
          OR area_supervision_id = $1
          OR area_ultima_devolucion_id = $1
       LIMIT 1`,
      [id]
    );
    if (tramites.rows.length > 0) {
      throw new ValidationError(
        'No se puede eliminar: hay trámites que referencian esta área (área actual, creador, supervisión o devolución).'
      );
    }

    const tar = await query(`SELECT 1 FROM tramite_areas_revision WHERE area_id = $1 LIMIT 1`, [id]);
    if (tar.rows.length > 0) {
      throw new ValidationError(
        'No se puede eliminar: el área figura en circuitos de revisión de trámites existentes.'
      );
    }

    const taa = await query(`SELECT 1 FROM tramite_areas_aprobadas WHERE area_id = $1 LIMIT 1`, [id]);
    if (taa.rows.length > 0) {
      throw new ValidationError(
        'No se puede eliminar: el área figura en el historial de aprobaciones de trámites.'
      );
    }

    const apf = await query(
      `SELECT 1 FROM archivos_por_firmar WHERE area_requerida_id = $1 LIMIT 1`,
      [id]
    );
    if (apf.rows.length > 0) {
      throw new ValidationError(
        'No se puede eliminar: hay registros de firma asociados a esta área.'
      );
    }

    try {
      await query(`DELETE FROM configuracion_areas WHERE id = $1`, [id]);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === '23503') {
        throw new ValidationError(
          'No se puede eliminar: el área sigue referenciada en la base de datos (p. ej. comentarios, bloqueos o presencia).'
        );
      }
      throw err;
    }
    return successResponse({ ok: true, id });
  } catch (error) {
    return errorResponse(error);
  }
}
