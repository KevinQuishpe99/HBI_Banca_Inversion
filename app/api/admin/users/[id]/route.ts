import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireRole } from '@/lib/auth/get-session';
import { z } from 'zod';
import { ValidationError, NotFoundError, ForbiddenError } from '@/lib/utils/errors';
import bcrypt from 'bcryptjs';

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  role: z.enum(['USER', 'AREA_USER', 'ADMIN']).optional(),
  /** Id numérico de área; null quita asignación (si la regla de negocio lo permite). */
  area: z.coerce.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  canSign: z.boolean().optional(),
  /** Solo administrador: nueva contraseña para login local (no se puede «ver» la anterior). */
  newPassword: z.string().min(6).optional(),
});

async function isSignEnabledArea(areaId?: number | null): Promise<boolean> {
  if (areaId == null || !Number.isFinite(areaId)) return false;
  const { areaSupportsUserSigning } = await import('@/lib/db/area-config-flags');
  return areaSupportsUserSigning(areaId);
}

/** Si el usuario deja de estar activo o se elimina, no puede seguir como supervisor titular en configuracion_areas. */
async function clearSupervisorTitularForUser(userId: string): Promise<void> {
  await query(`UPDATE configuracion_areas SET supervisor_id = NULL WHERE supervisor_id = $1`, [userId]);
}

/**
 * PATCH /api/admin/users/:id
 * Actualiza un usuario (solo admin)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('ADMIN');

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateUserSchema.parse(body);

    const existingUser = await query<{
      role: string;
      area: string | null;
      area_id: number | null;
      can_sign: boolean;
    }>(
      `SELECT u.id, u.rol AS role, ca.id::text AS area, u.area_id, u.puede_firmar AS can_sign
       FROM usuarios u
       LEFT JOIN configuracion_areas ca ON ca.id = u.area_id
       WHERE u.id = $1
       LIMIT 1`,
      [id]
    );
    if (existingUser.rows.length === 0) {
      return errorResponse(new NotFoundError('Usuario no encontrado'));
    }
    const current = existingUser.rows[0];
    const nextRole = validatedData.role ?? current.role;
    const nextAreaId =
      validatedData.area !== undefined ? validatedData.area : current.area_id;
    const nextCanSign = validatedData.canSign !== undefined ? validatedData.canSign : !!current.can_sign;

    if (nextAreaId == null) {
      return errorResponse(new ValidationError('El área es obligatoria'));
    }

    if (validatedData.area !== undefined && validatedData.area !== null) {
      const areaOk = await query(
        `SELECT 1 FROM configuracion_areas WHERE activo = true AND id = $1 LIMIT 1`,
        [validatedData.area]
      );
      if (areaOk.rows.length === 0) {
        return errorResponse(new ValidationError('Área inválida'));
      }
    }
    if (nextCanSign && (nextRole !== 'AREA_USER' || !(await isSignEnabledArea(nextAreaId)))) {
      return errorResponse(
        new ValidationError('Solo usuarios de un área con firma habilitada pueden tener firma activa')
      );
    }

    if (validatedData.email !== undefined) {
      const dup = await query(
        `SELECT id FROM usuarios WHERE lower(trim(email)) = lower(trim($1)) AND id <> $2 LIMIT 1`,
        [validatedData.email, id]
      );
      if (dup.rows.length > 0) {
        return errorResponse(new ValidationError('Ya existe otro usuario con ese correo'));
      }
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (validatedData.email !== undefined) {
      fields.push(`email = $${paramCount++}`);
      values.push(validatedData.email.trim());
    }
    if (validatedData.firstName !== undefined) {
      fields.push(`nombre = $${paramCount++}`);
      values.push(validatedData.firstName);
    }
    if (validatedData.lastName !== undefined) {
      fields.push(`apellido = $${paramCount++}`);
      values.push(validatedData.lastName);
    }
    if (validatedData.role !== undefined) {
      fields.push(`rol = $${paramCount++}`);
      values.push(validatedData.role);
    }
    if (validatedData.area !== undefined) {
      fields.push(`area_id = $${paramCount++}`);
      values.push(validatedData.area);
    }
    if (validatedData.isActive !== undefined) {
      fields.push(`activo = $${paramCount++}`);
      values.push(validatedData.isActive);
    }
    if (validatedData.canSign !== undefined) {
      fields.push(`puede_firmar = $${paramCount++}`);
      values.push(validatedData.canSign);
    }
    if (validatedData.newPassword !== undefined && validatedData.newPassword.length > 0) {
      const hashedPassword = await bcrypt.hash(validatedData.newPassword, 10);
      fields.push(`hash_contrasena = $${paramCount++}`);
      values.push(hashedPassword);
    }

    if (fields.length === 0) {
      return errorResponse(new ValidationError('No hay campos para actualizar'));
    }

    values.push(id);
    const result = await query(
      `WITH updated AS (
        UPDATE usuarios
        SET ${fields.join(', ')}, actualizado_en = CURRENT_TIMESTAMP
        WHERE id = $${paramCount}
        RETURNING *
      )
      SELECT u.id, u.email, u.nombre AS first_name, u.apellido AS last_name,
             u.rol AS role, ca.id::text AS area, u.puede_firmar AS can_sign,
             (
               (COALESCE(ca.permite_firma, false) = true AND COALESCE(ca.puede_completar_tramite, false) = false)
               OR COALESCE(ca.puede_completar_tramite, false) = true
             ) AS area_supports_signing,
             (
               u.puede_firmar = true
               AND u.rol = 'AREA_USER'
               AND (
                 (COALESCE(ca.permite_firma, false) = true AND COALESCE(ca.puede_completar_tramite, false) = false)
                 OR COALESCE(ca.puede_completar_tramite, false) = true
               )
             ) AS can_sign_effective,
             u.activo AS is_active, u.creado_en AS created_at
      FROM updated u
      LEFT JOIN configuracion_areas ca ON ca.id = u.area_id`,
      values
    );

    if (result.rows.length === 0) {
      return errorResponse(new NotFoundError('Usuario no encontrado'));
    }

    if (validatedData.isActive === false) {
      await clearSupervisorTitularForUser(id);
    }

    const updatedUser = {
      id: result.rows[0].id,
      email: result.rows[0].email,
      firstName: result.rows[0].first_name,
      lastName: result.rows[0].last_name,
      name: `${result.rows[0].first_name} ${result.rows[0].last_name}`,
      role: result.rows[0].role,
      area: result.rows[0].area,
      puedeFirmar: !!result.rows[0].can_sign,
      areaSupportsSigning: !!result.rows[0].area_supports_signing,
      canSign: !!result.rows[0].can_sign_effective,
      isActive: result.rows[0].is_active,
      createdAt: result.rows[0].created_at,
    };

    return successResponse(updatedUser);
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * DELETE /api/admin/users/:id
 * Elimina el usuario (solo admin). Si hay restricciones FK (trámites, etc.), solo desactiva.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole('ADMIN');
    const { id } = await params;

    if (id === session.user.id) {
      return errorResponse(new ForbiddenError('No puede eliminar su propio usuario'));
    }

    const existing = await query<{ role: string }>(
      `SELECT rol AS role FROM usuarios WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (existing.rows.length === 0) {
      return errorResponse(new NotFoundError('Usuario no encontrado'));
    }

    if (existing.rows[0].role === 'ADMIN') {
      const others = await query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM usuarios WHERE rol = 'ADMIN' AND activo = true AND id <> $1`,
        [id]
      );
      if (parseInt(others.rows[0]?.c ?? '0', 10) === 0) {
        return errorResponse(new ValidationError('No puede eliminar al único administrador activo'));
      }
    }

    try {
      await clearSupervisorTitularForUser(id);
      await query(`DELETE FROM usuarios WHERE id = $1`, [id]);
      return successResponse({
        message: 'Usuario eliminado correctamente',
        mode: 'deleted' as const,
      });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === '23503') {
        await query(
          `UPDATE usuarios SET activo = false, actualizado_en = CURRENT_TIMESTAMP WHERE id = $1`,
          [id]
        );
        await clearSupervisorTitularForUser(id);
        return successResponse({
          message:
            'Usuario desactivado: tiene trámites u otros registros asociados y no puede borrarse por completo.',
          mode: 'deactivated' as const,
        });
      }
      throw err;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
