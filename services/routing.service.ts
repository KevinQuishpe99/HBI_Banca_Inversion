import { query } from '@/lib/db';
import type { RoutingFlowKind, RoutingPolicyResolved } from '@/types/routing.types';
import type { PoolClient } from 'pg';

/**
 * Alinea trámites abiertos con la tabla enrutamiento_area_creador (p. ej. el trámite se creó en DIRECT_LEGAL
 * porque aún no había fila de enrutamiento; al configurar el flujo debe pasar a SUPERVISION_CHAIN).
 * No toca trámites con aprobaciones ya registradas ni supervisión ya completada con áreas asignadas.
 */
export async function reconcileTramitesRoutingWithEnrutamiento(): Promise<number> {
  const r = await query(
    `UPDATE tramites t
     SET
       tipo_flujo = e.tipo_flujo,
       area_supervision_id = CASE
         WHEN e.tipo_flujo = 'SUPERVISION_CHAIN' THEN e.area_supervision_id
         ELSE NULL
       END,
       supervision_completada = CASE
         WHEN e.tipo_flujo = 'DIRECT_LEGAL' THEN true
         WHEN t.tipo_flujo = 'DIRECT_LEGAL' AND e.tipo_flujo = 'SUPERVISION_CHAIN' THEN false
         ELSE t.supervision_completada
       END,
       actualizado_en = CURRENT_TIMESTAMP
     FROM enrutamiento_area_creador e
     WHERE t.area_creador_id = e.area_creador_id
       AND t.estado_id IN (1, 2, 4)
       AND NOT EXISTS (SELECT 1 FROM tramite_areas_aprobadas taa WHERE taa.tramite_id = t.id)
       AND (
         (e.tipo_flujo = 'SUPERVISION_CHAIN' AND t.tipo_flujo = 'DIRECT_LEGAL')
         OR (
           e.tipo_flujo = 'SUPERVISION_CHAIN'
           AND t.tipo_flujo = 'SUPERVISION_CHAIN'
           AND t.supervision_completada = false
           AND (t.area_supervision_id IS DISTINCT FROM e.area_supervision_id)
         )
         OR (
           e.tipo_flujo = 'DIRECT_LEGAL'
           AND t.tipo_flujo = 'SUPERVISION_CHAIN'
           AND t.supervision_completada = false
           AND NOT EXISTS (SELECT 1 FROM tramite_areas_revision tar WHERE tar.tramite_id = t.id)
         )
       )`
  );
  return r.rowCount ?? 0;
}

/**
 * Política por área del creador. Sin fila en enrutamiento_area_creador → directo a Legal (seguro por defecto).
 */
export async function resolveRoutingForCreatorArea(
  creatorAreaId: number | null | undefined
): Promise<RoutingPolicyResolved> {
  if (!creatorAreaId) {
    return { flowKind: 'DIRECT_LEGAL', supervisionAreaId: null };
  }
  const r = await query<{ tipo_flujo: string; area_supervision_id: number | null }>(
    `SELECT tipo_flujo, area_supervision_id
     FROM enrutamiento_area_creador
     WHERE area_creador_id = $1`,
    [creatorAreaId]
  );
  const row = r.rows[0];
  if (!row) {
    return { flowKind: 'DIRECT_LEGAL', supervisionAreaId: null };
  }
  const fk = row.tipo_flujo === 'SUPERVISION_CHAIN' ? 'SUPERVISION_CHAIN' : 'DIRECT_LEGAL';
  return {
    flowKind: fk,
    supervisionAreaId:
      fk === 'SUPERVISION_CHAIN' && row.area_supervision_id != null
        ? Number(row.area_supervision_id)
        : null,
  };
}

/**
 * Orden de áreas requeridas para aprobación secuencial.
 * SUPERVISION_CHAIN sin supervision_completada → ninguna aprobación aún.
 * SUPERVISION_CHAIN completado → primero "medias" (sin pasos finales), luego pasos finales.
 * DIRECT_LEGAL → pasos finales primero, luego el resto en sort_order.
 */
export async function getRequiredAreasOrdered(
  client: PoolClient,
  caseId: string
): Promise<number[]> {
  const cr = await client.query<{
    tipo_flujo: string | null;
    supervision_completada: boolean;
    area_supervision_id: number | null;
  }>(
    `SELECT tipo_flujo, supervision_completada, area_supervision_id FROM tramites WHERE id = $1`,
    [caseId]
  );
  const row = cr.rows[0];
  const flow = (row?.tipo_flujo as RoutingFlowKind | null) ?? 'DIRECT_LEGAL';

  const reviewRes = await client.query<{ area_id: number }>(
    `SELECT area_id FROM tramite_areas_revision WHERE tramite_id = $1`,
    [caseId]
  );
  const review = reviewRes.rows.map((r) => r.area_id);

  const mandatory = await client.query<{ area_id: number }>(
    `SELECT id AS area_id FROM configuracion_areas WHERE obligatorio = true AND activo = true`
  );
  const need = new Set<number>([...review, ...mandatory.rows.map((r) => r.area_id)]);

  if (flow === 'SUPERVISION_CHAIN' && !row?.supervision_completada) {
    return [];
  }

  const orderRows = await client.query<{ area_id: number; es_paso_final: boolean }>(
    `SELECT id AS area_id, es_paso_final FROM configuracion_areas WHERE activo = true ORDER BY orden ASC`
  );

  if (flow === 'SUPERVISION_CHAIN') {
    const supervisionAreaId = row?.area_supervision_id ?? null;
    if (supervisionAreaId != null) need.add(supervisionAreaId);
    const middle: number[] = [];
    const tail: number[] = [];
    for (const r of orderRows.rows) {
      if (!need.has(r.area_id)) continue;
      if (r.es_paso_final) tail.push(r.area_id);
      else middle.push(r.area_id);
    }
    const middleWithoutSupervision = middle.filter((id) => id !== supervisionAreaId);
    const head = supervisionAreaId != null ? [supervisionAreaId] : [];
    return [...head, ...middleWithoutSupervision, ...tail];
  }

  const finalFirst: number[] = [];
  const rest: number[] = [];
  for (const r of orderRows.rows) {
    if (!need.has(r.area_id)) continue;
    if (r.es_paso_final) finalFirst.push(r.area_id);
    else rest.push(r.area_id);
  }
  return [...finalFirst, ...rest];
}

/**
 * Orden del circuito mientras SUPERVISION_CHAIN sigue sin cerrarse (`supervision_completada = false`).
 * Incluye siempre el área de supervisión y el resto según `tramite_areas_revision` + obligatorias
 * (misma regla middle/tail que cuando la supervisión ya está completa).
 */
export async function getSupervisionChainIncompleteOrderedAreaIds(
  client: PoolClient,
  caseId: string,
  supervisionAreaId: number
): Promise<number[]> {
  const reviewRes = await client.query<{ area_id: number }>(
    `SELECT area_id FROM tramite_areas_revision WHERE tramite_id = $1`,
    [caseId]
  );
  const review = reviewRes.rows.map((r) => r.area_id);
  const mandatory = await client.query<{ area_id: number }>(
    `SELECT id AS area_id FROM configuracion_areas WHERE obligatorio = true AND activo = true`
  );
  const need = new Set<number>([
    ...review,
    ...mandatory.rows.map((r) => r.area_id),
    supervisionAreaId,
  ]);

  const orderRows = await client.query<{ area_id: number; es_paso_final: boolean }>(
    `SELECT id AS area_id, es_paso_final FROM configuracion_areas WHERE activo = true ORDER BY orden ASC`
  );
  const middle: number[] = [];
  const tail: number[] = [];
  for (const r of orderRows.rows) {
    if (!need.has(r.area_id)) continue;
    if (r.es_paso_final) tail.push(r.area_id);
    else middle.push(r.area_id);
  }
  const middleWithoutSupervision = middle.filter((id) => id !== supervisionAreaId);
  return [supervisionAreaId, ...middleWithoutSupervision, ...tail];
}

/** Misma lógica de orden que `getRequiredAreasOrdered`, en memoria (filas ya ordenadas por `orden`). */
export type AreaOrderRow = { area_id: number; es_paso_final: boolean };

export function buildOrderedReviewAreaIds(params: {
  routingFlow: RoutingFlowKind | null;
  supervisionCompleted: boolean;
  supervisionAreaId?: number | null;
  reviewAreaIds: number[];
  mandatoryAreaIds: number[];
  orderRows: readonly AreaOrderRow[];
}): number[] {
  const flow = params.routingFlow ?? 'DIRECT_LEGAL';
  const need = new Set<number>([...params.reviewAreaIds, ...params.mandatoryAreaIds]);
  if (flow === 'SUPERVISION_CHAIN' && !params.supervisionCompleted) {
    return [];
  }
  if (flow === 'SUPERVISION_CHAIN') {
    const supervisionAreaId = params.supervisionAreaId ?? null;
    if (supervisionAreaId != null) need.add(supervisionAreaId);
    const middle: number[] = [];
    const tail: number[] = [];
    for (const r of params.orderRows) {
      if (!need.has(r.area_id)) continue;
      if (r.es_paso_final) tail.push(r.area_id);
      else middle.push(r.area_id);
    }
    const middleWithoutSupervision = middle.filter((id) => id !== supervisionAreaId);
    const head = supervisionAreaId != null ? [supervisionAreaId] : [];
    return [...head, ...middleWithoutSupervision, ...tail];
  }
  const finalFirst: number[] = [];
  const rest: number[] = [];
  for (const r of params.orderRows) {
    if (!need.has(r.area_id)) continue;
    if (r.es_paso_final) finalFirst.push(r.area_id);
    else rest.push(r.area_id);
  }
  return [...finalFirst, ...rest];
}

/**
 * Área con paso final: solo debe ver el trámite cuando ya aprobaron todas las áreas anteriores en el circuito
 * (incluye otras finales previas, p. ej. Legal antes que Director General).
 */
export function finalAreaMaySeeCaseInReviewList(params: {
  routingFlow: RoutingFlowKind | null;
  supervisionCompleted: boolean;
  viewerAreaId: number;
  orderedAreaIds: number[];
  approvedReviewAreas: number[];
}): boolean {
  const flow = params.routingFlow ?? 'DIRECT_LEGAL';
  if (flow === 'SUPERVISION_CHAIN' && !params.supervisionCompleted) {
    return false;
  }
  const ordered = params.orderedAreaIds;
  const idx = ordered.indexOf(params.viewerAreaId);
  if (idx < 0) return false;
  const before = ordered.slice(0, idx);
  return before.every((a) => params.approvedReviewAreas.includes(a));
}
