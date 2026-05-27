import { NextRequest } from 'next/server';
import { query, transaction } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireRole } from '@/lib/auth/get-session';
import { z } from 'zod';
import { ValidationError } from '@/lib/utils/errors';
import {
  getAmountAlertThreshold,
  setAmountAlertThreshold,
  getDeadlineAlertConfig,
  setDeadlineAlertConfig,
} from '@/services/app-settings.service';
import { reconcileTramitesRoutingWithEnrutamiento } from '@/services/routing.service';

const putSchema = z.object({
  supervisionChain: z.object({
    creatorAreas: z.array(z.coerce.number().int().positive()),
    supervisionArea: z.coerce.number().int().positive().optional(),
  }),
  directLegal: z.object({
    creatorAreas: z.array(z.coerce.number().int().positive()),
  }),
  /** Umbral en USD: si el monto declarado es ≥ este valor, se dispara la alerta por monto. */
  amountAlertThreshold: z.number().positive().optional(),
  /** Ids de áreas destinatarias de la alerta por monto alto (`configuracion_areas.id`). */
  amountAlertAreaCodes: z.array(z.coerce.number().int().positive()).optional(),
  deadlineAlerts: z
    .object({
      reminderDays: z.number().int().min(0).max(90),
      overdueEnabled: z.boolean(),
      overdueRepeatDays: z.number().int().min(1).max(90),
    })
    .optional(),
});

/**
 * GET /api/admin/routing-flows
 */
export async function GET() {
  try {
    await requireRole('ADMIN');
    const r = await query<{
      creator_area: string;
      flow_kind: string;
      supervision_area: string | null;
    }>(
      `SELECT ca.id::text AS creator_area, e.tipo_flujo AS flow_kind, sa.id::text AS supervision_area
       FROM enrutamiento_area_creador e
       JOIN configuracion_areas ca ON ca.id = e.area_creador_id
       LEFT JOIN configuracion_areas sa ON sa.id = e.area_supervision_id
       ORDER BY ca.id`
    );
    const supervision: { creatorAreas: string[]; supervisionArea: string | null } = {
      creatorAreas: [],
      supervisionArea: null,
    };
    const direct: string[] = [];
    for (const row of r.rows) {
      if (row.flow_kind === 'SUPERVISION_CHAIN') {
        supervision.creatorAreas.push(row.creator_area);
        supervision.supervisionArea = row.supervision_area;
      } else {
        direct.push(row.creator_area);
      }
    }
    const [amountAlertThreshold, deadlineAlerts, amountAlertAreasRes] = await Promise.all([
      getAmountAlertThreshold(),
      getDeadlineAlertConfig(),
      query<{ id: string }>(
        `SELECT id::text AS id FROM configuracion_areas
         WHERE activo = true AND notificar_monto_alto = true
         ORDER BY orden ASC`
      ),
    ]);
    return successResponse({
      supervisionChain: {
        creatorAreas: supervision.creatorAreas,
        supervisionArea: supervision.supervisionArea,
      },
      directLegal: { creatorAreas: direct },
      amountAlertThreshold,
      amountAlertAreaCodes: amountAlertAreasRes.rows.map((row) => row.id),
      deadlineAlerts,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * PUT /api/admin/routing-flows
 * Reemplaza la configuración completa (sin solapamiento entre flujos).
 */
export async function PUT(request: NextRequest) {
  try {
    await requireRole('ADMIN');
    const body = putSchema.parse(await request.json());

    if (body.amountAlertThreshold !== undefined) {
      await setAmountAlertThreshold(body.amountAlertThreshold);
    }
    if (body.deadlineAlerts) {
      await setDeadlineAlertConfig(body.deadlineAlerts);
    }
    const amountAlertAreaIds = [...new Set(body.amountAlertAreaCodes ?? [])];
    if (amountAlertAreaIds.length === 0) {
      throw new ValidationError('Seleccione al menos un área para alertas por monto');
    }

    const set1 = new Set(body.supervisionChain.creatorAreas);
    const set2 = new Set(body.directLegal.creatorAreas);
    for (const a of set1) {
      if (set2.has(a)) {
        throw new ValidationError(`El área ${a} no puede estar en ambos flujos`);
      }
    }

    const supId = body.supervisionChain.supervisionArea;
    if (set1.size > 0 && supId == null) {
      throw new ValidationError('Indique el área de supervisión para el flujo con asignación de revisiones');
    }

    await transaction(async (client) => {
      const validRes = await client.query<{ id: number }>(
        `SELECT id FROM configuracion_areas WHERE activo = true`
      );
      const validIds = new Set(validRes.rows.map((row) => row.id));
      const invalid = amountAlertAreaIds.filter((id) => !validIds.has(id));
      if (invalid.length > 0) {
        throw new ValidationError(`Áreas inválidas para alerta por monto: ${invalid.join(', ')}`);
      }

      await client.query(`DELETE FROM enrutamiento_area_creador`);
      for (const ca of set1) {
        if (!validIds.has(ca)) {
          throw new ValidationError(`Área de creador inválida: ${ca}`);
        }
        if (supId == null) {
          throw new ValidationError('Falta área de supervisión');
        }
        if (!validIds.has(supId)) {
          throw new ValidationError(`Área de supervisión inválida: ${supId}`);
        }
        await client.query(
          `INSERT INTO enrutamiento_area_creador (area_creador_id, tipo_flujo, area_supervision_id)
           VALUES ($1, 'SUPERVISION_CHAIN', $2)`,
          [ca, supId]
        );
      }
      for (const ca of set2) {
        if (!validIds.has(ca)) {
          throw new ValidationError(`Área de creador inválida: ${ca}`);
        }
        await client.query(
          `INSERT INTO enrutamiento_area_creador (area_creador_id, tipo_flujo, area_supervision_id)
           VALUES ($1, 'DIRECT_LEGAL', NULL)`,
          [ca]
        );
      }

      await client.query(`UPDATE configuracion_areas SET notificar_monto_alto = false WHERE activo = true`);
      await client.query(
        `UPDATE configuracion_areas
         SET notificar_monto_alto = true
         WHERE activo = true AND id = ANY($1::int[])`,
        [amountAlertAreaIds]
      );
    });

    const reconciled = await reconcileTramitesRoutingWithEnrutamiento();
    const r = await query(`SELECT COUNT(*)::int AS n FROM enrutamiento_area_creador`);
    return successResponse({ ok: true, rows: r.rows[0]?.n ?? 0, tramitesReconciliados: reconciled });
  } catch (error) {
    return errorResponse(error);
  }
}
