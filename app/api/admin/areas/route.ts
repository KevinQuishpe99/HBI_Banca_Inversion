import { NextRequest } from 'next/server';
import { query, transaction } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireRole } from '@/lib/auth/get-session';
import { z } from 'zod';
import { ValidationError } from '@/lib/utils/errors';
import { hasSupervisorPuedeCrearTramiteColumn } from '@/lib/db/configuracion-areas-columns';
import type { PoolClient } from 'pg';

const createBodySchema = z.object({
  label: z.string().min(1),
  isActive: z.boolean().optional(),
  isSelectable: z.boolean().optional(),
  isMandatory: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  memberUserIds: z.array(z.string().uuid()).optional(),
  supervisorUserId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  id: z.coerce.number().int(),
  label: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  isSelectable: z.boolean().optional(),
  isMandatory: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  supervisorUserId: z.string().uuid().nullable().optional(),
  supervisorCanCreateCase: z.boolean().optional(),
  /** Firma de documentos (área tipo Legal); excluye cierre de trámite. */
  allowsSigning: z.boolean().optional(),
  /** Director / quien completa el trámite; excluye firma Legal en el mismo área. */
  canCompleteCase: z.boolean().optional(),
});

function mapAreaRow(r: Record<string, unknown>) {
  return {
    id: r.id,
    area: String(r.id),
    label: r.label,
    isActive: r.is_active,
    isSelectable: r.is_selectable,
    isMandatory: r.is_mandatory,
    sortOrder: r.sort_order,
    supervisorId: r.supervisor_id ?? null,
    supervisorName: r.supervisor_name ?? null,
    supervisorEmail: r.supervisor_email ?? null,
    allowsSigning: r.allows_signing === true,
    isFinalStep: r.is_final_step === true,
    notifyOnHighAmount: r.notify_on_high_amount === true,
    canCompleteCase: r.can_complete_case === true,
    supervisorCanCreateCase: r.supervisor_puede_crear_tramite !== false,
  };
}

async function assertSupervisorInArea(
  client: PoolClient,
  areaId: number,
  supervisorUserId: string
) {
  const ok = await client.query(
    `SELECT 1 FROM usuarios u
     JOIN configuracion_areas ca ON ca.id = u.area_id
     WHERE u.id = $1 AND u.rol = 'AREA_USER' AND ca.id = $2 AND u.activo = true`,
    [supervisorUserId, areaId]
  );
  if (ok.rows.length === 0) {
    throw new ValidationError('El supervisor debe ser un usuario de área activo asignado a esta área');
  }
}

async function assertSupervisorOnlyOneArea(
  client: PoolClient,
  supervisorUserId: string,
  excludeAreaId: number
) {
  const dup = await client.query<{ nombre_area: string }>(
    `SELECT nombre_area FROM configuracion_areas
     WHERE supervisor_id = $1 AND id <> $2
     LIMIT 1`,
    [supervisorUserId, excludeAreaId]
  );
  if (dup.rows.length > 0) {
    throw new ValidationError(
      `Este usuario ya es supervisor del área «${dup.rows[0].nombre_area}». Solo puede ser supervisor de un área a la vez.`
    );
  }
}

async function getAreaSelectSql(): Promise<string> {
  const hasCol = await hasSupervisorPuedeCrearTramiteColumn();
  const supExpr = hasCol
    ? 'ac.supervisor_puede_crear_tramite AS supervisor_puede_crear_tramite'
    : 'TRUE AS supervisor_puede_crear_tramite';
  return `
  SELECT ac.id,
         ac.id::text AS area,
         ac.nombre_area AS label,
         ac.activo AS is_active,
         ac.seleccionable AS is_selectable,
         ac.obligatorio AS is_mandatory,
         ac.orden AS sort_order,
         ac.supervisor_id,
         ac.permite_firma AS allows_signing,
         ac.es_paso_final AS is_final_step,
         ac.notificar_monto_alto AS notify_on_high_amount,
         ac.puede_completar_tramite AS can_complete_case,
         ${supExpr},
         trim(COALESCE(su.nombre,'') || ' ' || COALESCE(su.apellido,'')) AS supervisor_name,
         su.email AS supervisor_email
  FROM configuracion_areas ac
  LEFT JOIN usuarios su ON su.id = ac.supervisor_id`;
}

/**
 * GET /api/admin/areas
 * Lista configuración de áreas (solo admin)
 */
export async function GET() {
  try {
    await requireRole('ADMIN');
    const sql = await getAreaSelectSql();
    const result = await query(`${sql} ORDER BY ac.orden ASC`);
    return successResponse(result.rows.map(mapAreaRow));
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/admin/areas
 * Crea una nueva área: asigna usuarios al área y define supervisor (solo admin)
 */
export async function POST(request: NextRequest) {
  try {
    await requireRole('ADMIN');
    const body = await request.json();
    const data = createBodySchema.parse(body);

    const memberUserIds = data.memberUserIds ?? [];
    const hasMembers = memberUserIds.length > 0;
    const hasSupervisor = data.supervisorUserId != null;
    if (hasMembers !== hasSupervisor) {
      throw new ValidationError(
        'Indique miembros y supervisor, o deje ambos vacíos para crear solo el área en catálogo.'
      );
    }
    if (hasMembers && hasSupervisor && !memberUserIds.includes(data.supervisorUserId!)) {
      throw new ValidationError('El supervisor debe estar entre los miembros seleccionados');
    }

    let newAreaId!: number;

    if (!hasMembers && !hasSupervisor) {
      const ins = await query<{ id: number }>(
        `INSERT INTO configuracion_areas (nombre_area, activo, seleccionable, obligatorio, orden, supervisor_id)
         VALUES ($1, $2, $3, $4, $5, NULL)
         RETURNING id`,
        [
          data.label,
          data.isActive ?? true,
          data.isSelectable ?? true,
          data.isMandatory ?? false,
          data.sortOrder ?? 100,
        ]
      );
      newAreaId = ins.rows[0]!.id;
    } else {
      await transaction(async (client: PoolClient) => {
        const members = await client.query<{ id: string }>(
          `SELECT id FROM usuarios WHERE id = ANY($1::uuid[])`,
          [memberUserIds]
        );
        if (members.rows.length !== memberUserIds.length) {
          throw new ValidationError('Uno o más usuarios no existen');
        }

        await client.query(
          `UPDATE configuracion_areas SET supervisor_id = NULL WHERE supervisor_id = ANY($1::uuid[])`,
          [memberUserIds]
        );

        const ins = await client.query<{ id: number }>(
          `INSERT INTO configuracion_areas (nombre_area, activo, seleccionable, obligatorio, orden, supervisor_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [
            data.label,
            data.isActive ?? true,
            data.isSelectable ?? true,
            data.isMandatory ?? false,
            data.sortOrder ?? 100,
            data.supervisorUserId,
          ]
        );
        newAreaId = ins.rows[0]!.id;

        await client.query(
          `UPDATE usuarios
           SET rol = 'AREA_USER',
               area_id = $1,
               actualizado_en = CURRENT_TIMESTAMP
           WHERE id = ANY($2::uuid[])`,
          [newAreaId, memberUserIds]
        );

        await assertSupervisorInArea(client, newAreaId, data.supervisorUserId!);
        await assertSupervisorOnlyOneArea(client, data.supervisorUserId!, newAreaId);
      });
    }

    const sql = await getAreaSelectSql();
    const result = await query(`${sql} WHERE ac.id = $1`, [newAreaId]);
    if (!result.rows.length) throw new ValidationError('Área no encontrada tras crear');
    return successResponse(mapAreaRow(result.rows[0]));
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * PATCH /api/admin/areas
 * Actualiza un área por id (solo admin).
 */
export async function PATCH(request: NextRequest) {
  try {
    await requireRole('ADMIN');
    const body = await request.json();
    const data = updateSchema.parse(body);

    await transaction(async (client: PoolClient) => {
      const fields: string[] = [];
      const values: unknown[] = [];
      let p = 1;

      if (data.label !== undefined) {
        fields.push(`nombre_area = $${p++}`);
        values.push(data.label);
      }
      if (data.isActive !== undefined) {
        fields.push(`activo = $${p++}`);
        values.push(data.isActive);
      }
      if (data.isSelectable !== undefined) {
        fields.push(`seleccionable = $${p++}`);
        values.push(data.isSelectable);
      }
      if (data.isMandatory !== undefined) {
        fields.push(`obligatorio = $${p++}`);
        values.push(data.isMandatory);
      }
      if (data.sortOrder !== undefined) {
        fields.push(`orden = $${p++}`);
        values.push(data.sortOrder);
      }
      if (data.supervisorUserId !== undefined) {
        if (data.supervisorUserId != null) {
          await assertSupervisorInArea(client, data.id, data.supervisorUserId);
          await assertSupervisorOnlyOneArea(client, data.supervisorUserId, data.id);
        }
        fields.push(`supervisor_id = $${p++}`);
        values.push(data.supervisorUserId);
      }
      if (data.supervisorCanCreateCase !== undefined) {
        const hasCol = await hasSupervisorPuedeCrearTramiteColumn();
        if (!hasCol) {
          throw new ValidationError('No se pudo guardar');
        }
        fields.push(`supervisor_puede_crear_tramite = $${p++}`);
        values.push(data.supervisorCanCreateCase);
      }

      let permiteFirma: boolean | null = null;
      let puedeCompletar: boolean | null = null;
      if (data.allowsSigning !== undefined) {
        permiteFirma = data.allowsSigning;
      }
      if (data.canCompleteCase !== undefined) {
        puedeCompletar = data.canCompleteCase;
      }
      if (permiteFirma === true) {
        await client.query(`UPDATE configuracion_areas SET permite_firma = false WHERE id <> $1`, [data.id]);
      }
      if (puedeCompletar === true) {
        await client.query(`UPDATE configuracion_areas SET puede_completar_tramite = false WHERE id <> $1`, [
          data.id,
        ]);
      }
      if (permiteFirma !== null) {
        fields.push(`permite_firma = $${p++}`);
        values.push(permiteFirma);
      }
      if (puedeCompletar !== null) {
        fields.push(`puede_completar_tramite = $${p++}`);
        values.push(puedeCompletar);
      }

      if (!fields.length) {
        throw new ValidationError('No se pudo guardar');
      }

      values.push(data.id);
      const result = await client.query(
        `UPDATE configuracion_areas
         SET ${fields.join(', ')}
         WHERE id = $${p}
         RETURNING id`,
        values
      );

      if (!result.rows.length) throw new ValidationError('No se pudo guardar');
    });

    const sql = await getAreaSelectSql();
    const result = await query(`${sql} WHERE ac.id = $1`, [data.id]);
    if (!result.rows.length) throw new ValidationError('No se pudo guardar');
    return successResponse(mapAreaRow(result.rows[0]));
  } catch (error) {
    return errorResponse(error);
  }
}
