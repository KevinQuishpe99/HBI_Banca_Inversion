import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireRole } from '@/lib/auth/get-session';
import { ValidationError } from '@/lib/utils/errors';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { sendAccountCredentialsEmail } from '@/lib/email/notification-emails';

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  role: z.enum(['USER', 'AREA_USER', 'ADMIN']),
  /** Id numérico de `configuracion_areas` (acepta string desde JSON). */
  area: z.coerce.number().int().positive({ message: 'Seleccione un área' }),
  canSign: z.boolean().optional(),
});

async function isSignEnabledArea(areaId?: number | null): Promise<boolean> {
  if (areaId == null || !Number.isFinite(areaId)) return false;
  const { areaSupportsUserSigning } = await import('@/lib/db/area-config-flags');
  return areaSupportsUserSigning(areaId);
}

/**
 * GET /api/admin/users
 * Obtiene todos los usuarios (solo admin)
 */
export async function GET() {
  try {
    await requireRole('ADMIN');

    const result = await query(
      `SELECT u.id, u.email,
              u.nombre AS first_name, u.apellido AS last_name,
              u.rol AS role, ca.id::text AS area,
              u.puede_firmar AS can_sign,
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
              u.activo AS is_active,
              u.creado_en AS created_at, u.ultimo_acceso AS last_login
       FROM usuarios u
       LEFT JOIN configuracion_areas ca ON ca.id = u.area_id
       ORDER BY u.creado_en DESC`
    );

    const users = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      name: `${row.first_name} ${row.last_name}`,
      role: row.role,
      area: row.area != null ? String(row.area) : null,
      puedeFirmar: !!row.can_sign,
      areaSupportsSigning: !!row.area_supports_signing,
      canSign: !!row.can_sign_effective,
      isActive: row.is_active,
      createdAt: row.created_at,
      lastLogin: row.last_login,
    }));

    return successResponse(users);
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/admin/users
 * Crea un nuevo usuario (solo admin)
 */
export async function POST(request: NextRequest) {
  try {
    await requireRole('ADMIN');

    const body = await request.json();
    const validatedData = createUserSchema.parse(body);

    const existingUser = await query(
      'SELECT id FROM usuarios WHERE email = $1',
      [validatedData.email]
    );

    if (existingUser.rows.length > 0) {
      return errorResponse(new ValidationError('El email ya está registrado'));
    }

    if (validatedData.canSign && (validatedData.role !== 'AREA_USER' || !(await isSignEnabledArea(validatedData.area)))) {
      return errorResponse(
        new ValidationError('Solo usuarios de un área con firma habilitada pueden tener firma activa')
      );
    }

    const areaOk = await query(
      `SELECT 1 FROM configuracion_areas WHERE activo = true AND id = $1 LIMIT 1`,
      [validatedData.area]
    );
    if (areaOk.rows.length === 0) {
      return errorResponse(new ValidationError('Área inválida'));
    }

    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    const result = await query(
      `WITH new_user AS (
        INSERT INTO usuarios (email, hash_contrasena, nombre, apellido, rol, area_id, puede_firmar)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      )
      SELECT nu.id, nu.email, nu.nombre AS first_name, nu.apellido AS last_name,
             nu.rol AS role, ca.id::text AS area, nu.puede_firmar AS can_sign,
             (
               (COALESCE(ca.permite_firma, false) = true AND COALESCE(ca.puede_completar_tramite, false) = false)
               OR COALESCE(ca.puede_completar_tramite, false) = true
             ) AS area_supports_signing,
             (
               nu.puede_firmar = true
               AND nu.rol = 'AREA_USER'
               AND (
                 (COALESCE(ca.permite_firma, false) = true AND COALESCE(ca.puede_completar_tramite, false) = false)
                 OR COALESCE(ca.puede_completar_tramite, false) = true
               )
             ) AS can_sign_effective,
             nu.activo AS is_active, nu.creado_en AS created_at
      FROM new_user nu
      LEFT JOIN configuracion_areas ca ON ca.id = nu.area_id`,
      [
        validatedData.email,
        hashedPassword,
        validatedData.firstName,
        validatedData.lastName,
        validatedData.role,
        validatedData.area,
        !!validatedData.canSign,
      ]
    );

    const newUser = {
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

    const displayName = `${validatedData.firstName} ${validatedData.lastName}`.trim();
    try {
      await sendAccountCredentialsEmail(
        validatedData.email,
        displayName,
        validatedData.password,
        'admin_created'
      );
    } catch (e) {
      console.error('[admin/users] correo con credenciales no enviado', e);
    }

    return successResponse(newUser, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
