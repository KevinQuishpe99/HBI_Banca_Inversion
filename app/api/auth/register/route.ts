import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ValidationError } from '@/lib/utils/errors';
import { isComwareRegistrationEmail } from '@/lib/auth/registration-email';
import { sendAccountCredentialsEmail } from '@/lib/email/notification-emails';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  area: z.string().trim().min(1, 'Debe seleccionar el área a la que pertenece.'),
});

/**
 * POST /api/auth/register
 * Autoregistro solo con correo @comware.com.ec
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = registerSchema.parse(body);
    const email = data.email.trim();

    if (!isComwareRegistrationEmail(email)) {
      throw new ValidationError('Usa un correo @comware.com.ec.');
    }

    const existing = await query('SELECT id FROM usuarios WHERE lower(trim(email)) = lower(trim($1))', [email]);
    if (existing.rows.length > 0) {
      throw new ValidationError('Ese correo ya está en uso.');
    }

    const areaRaw = data.area.trim();
    const areaId = Number.parseInt(areaRaw, 10);
    if (!Number.isFinite(areaId) || areaId <= 0) {
      throw new ValidationError('Área inválida. Seleccione un área válida del listado.');
    }
    const areaOk = await query(
      `SELECT 1 FROM configuracion_areas
       WHERE activo = true
         AND seleccionable = true
         AND id = $1
       LIMIT 1`,
      [areaId]
    );
    if (areaOk.rows.length === 0) {
      throw new ValidationError(
        'Área inválida, inactiva o no disponible para autoregistro. Use solo áreas marcadas como seleccionables en administración.'
      );
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const result = await query(
      `WITH new_user AS (
        INSERT INTO usuarios (email, hash_contrasena, nombre, apellido, rol, area_id, puede_firmar, activo)
        VALUES ($1, $2, $3, $4, 'USER', $5, false, true)
        RETURNING *
      )
      SELECT nu.id, nu.email, nu.nombre AS first_name, nu.apellido AS last_name
      FROM new_user nu`,
      [email, hashedPassword, data.firstName.trim(), data.lastName.trim(), areaId]
    );

    const row = result.rows[0];
    const displayName = `${row.first_name} ${row.last_name}`.trim();

    try {
      await sendAccountCredentialsEmail(row.email, displayName, data.password, 'registration');
    } catch (e) {
      console.error('[register] correo con credenciales no enviado', e);
    }

    return successResponse(
      {
        id: row.id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
      },
      201
    );
  } catch (error) {
    return errorResponse(error);
  }
}
