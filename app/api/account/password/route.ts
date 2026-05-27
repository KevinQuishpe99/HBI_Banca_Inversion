import { NextRequest } from 'next/server';
import bcrypt, { compare } from 'bcryptjs';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth/get-session';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ValidationError } from '@/lib/utils/errors';
import { changePasswordSchema } from '@/lib/validations/account-password.schema';
import { isMicrosoftOAuthConfigured } from '@/lib/auth/microsoft-auth';
import { esModoDemo } from '@/lib/demo/app-mode';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/account/password
 * Indica si el usuario puede cambiar contraseña local y si Microsoft está disponible en el sistema.
 */
export async function GET() {
  try {
    const session = await requireAuth();
    if (esModoDemo()) {
      return successResponse({
        hasLocalPassword: true,
        microsoftLoginEnabled: false,
      });
    }
    const r = await query<{ tiene_hash: boolean }>(
      `SELECT (hash_contrasena IS NOT NULL AND trim(hash_contrasena) <> '') AS tiene_hash
       FROM usuarios WHERE id = $1`,
      [session.user.id]
    );
    const tieneHash = r.rows[0]?.tiene_hash === true;
    return successResponse({
      hasLocalPassword: tieneHash,
      microsoftLoginEnabled: isMicrosoftOAuthConfigured(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * PATCH /api/account/password
 * Cambia la contraseña local (requiere contraseña actual si ya tenía una).
 * Si solo usa Microsoft, puede establecer una contraseña local sin la actual.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (esModoDemo()) {
      return successResponse({
        message: 'Modo demo: use la contraseña Demo2026! (no se puede cambiar aquí).',
      });
    }
    const body = await request.json();
    const data = changePasswordSchema.parse(body);

    const userRow = await query<{ hash_contrasena: string | null; activo: boolean }>(
      `SELECT hash_contrasena, activo FROM usuarios WHERE id = $1`,
      [session.user.id]
    );
    const row = userRow.rows[0];
    if (!row || !row.activo) {
      throw new ValidationError('Usuario no encontrado o inactivo');
    }

    const hasLocalPassword =
      row.hash_contrasena != null && String(row.hash_contrasena).trim() !== '';

    if (hasLocalPassword) {
      const actual = data.currentPassword?.trim() ?? '';
      if (!actual) {
        throw new ValidationError('Ingrese su contraseña actual');
      }
      const ok = await compare(actual, row.hash_contrasena as string);
      if (!ok) {
        throw new ValidationError('La contraseña actual no es correcta');
      }
    }

    const hashed = await bcrypt.hash(data.newPassword, 10);
    await query(
      `UPDATE usuarios SET hash_contrasena = $1, actualizado_en = CURRENT_TIMESTAMP WHERE id = $2`,
      [hashed, session.user.id]
    );

    await query(
      `INSERT INTO registro_auditoria (usuario_id, accion, tipo_entidad, entidad_id, comentario)
       VALUES ($1, 'UPDATED', 'user', $1, $2)`,
      [
        session.user.id,
        hasLocalPassword
          ? 'Usuario cambió su contraseña desde el perfil'
          : 'Usuario estableció contraseña local desde el perfil',
      ]
    );

    return successResponse({
      message: hasLocalPassword
        ? 'Contraseña actualizada correctamente'
        : 'Contraseña establecida. Ya puede iniciar sesión con correo y contraseña.',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
