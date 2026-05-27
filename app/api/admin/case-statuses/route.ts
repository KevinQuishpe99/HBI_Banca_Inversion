import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireRole } from '@/lib/auth/get-session';
import { z } from 'zod';
import { ValidationError } from '@/lib/utils/errors';
import { isValidStatusVariant } from '@/lib/status-config';
import { caseStatusCodeFromConfigEstadoId } from '@/lib/db/estado-tramite-map';

const patchSchema = z.object({
  id: z.number().int().positive(),
  label: z.string().min(1).optional(),
  variant: z
    .string()
    .optional()
    .refine((v) => v === undefined || isValidStatusVariant(v), { message: 'Variante de color inválida' }),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

type DbRow = {
  id: number;
  label: string;
  variant: string;
  sort_order: number;
  is_active: boolean;
};

export async function GET() {
  try {
    await requireRole('ADMIN');
    const result = await query<DbRow>(
      `SELECT id,
              nombre AS label,
              variante AS variant,
              orden AS sort_order,
              activo AS is_active
       FROM configuracion_estados
       ORDER BY orden ASC`
    );
    return successResponse(
      result.rows.map((r) => ({
        id: r.id,
        code: caseStatusCodeFromConfigEstadoId(r.id),
        label: r.label,
        variant: r.variant,
        sortOrder: r.sort_order,
        isActive: r.is_active,
      }))
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireRole('ADMIN');
    const body = await request.json();
    const data = patchSchema.parse(body);

    const existing = await query('SELECT 1 FROM configuracion_estados WHERE id = $1', [data.id]);
    if (existing.rows.length === 0) {
      throw new ValidationError('Estado no válido');
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (data.label !== undefined) {
      updates.push(`nombre = $${i++}`);
      values.push(data.label);
    }
    if (data.variant !== undefined) {
      updates.push(`variante = $${i++}`);
      values.push(data.variant);
    }
    if (data.sortOrder !== undefined) {
      updates.push(`orden = $${i++}`);
      values.push(data.sortOrder);
    }
    if (data.isActive !== undefined) {
      updates.push(`activo = $${i++}`);
      values.push(data.isActive);
    }
    if (!updates.length) {
      throw new ValidationError('Nada que actualizar');
    }
    values.push(data.id);

    await query(
      `UPDATE configuracion_estados SET ${updates.join(', ')} WHERE id = $${i}`,
      values
    );

    const row = await query<DbRow>(
      `SELECT id,
              nombre AS label,
              variante AS variant,
              orden AS sort_order,
              activo AS is_active
       FROM configuracion_estados WHERE id = $1`,
      [data.id]
    );
    const r = row.rows[0];
    if (!r) {
      throw new ValidationError('Estado no encontrado tras actualizar');
    }
    return successResponse({
      id: r.id,
      code: caseStatusCodeFromConfigEstadoId(r.id),
      label: r.label,
      variant: r.variant,
      sortOrder: r.sort_order,
      isActive: r.is_active,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
