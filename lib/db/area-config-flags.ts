import { query } from '@/lib/db';
import type { PoolClient } from 'pg';

export interface AreaConfigRow {
  id: number;
  nombre_area: string;
  activo: boolean;
  obligatorio: boolean;
  es_paso_final: boolean;
  notificar_monto_alto: boolean;
  permite_firma: boolean;
  puede_completar_tramite: boolean;
  orden: number;
}

const FIELDS = `id, nombre_area, activo, obligatorio, es_paso_final,
  notificar_monto_alto, permite_firma, puede_completar_tramite, orden`;

export async function getAllAreaConfig(): Promise<AreaConfigRow[]> {
  const r = await query<AreaConfigRow>(
    `SELECT ${FIELDS} FROM configuracion_areas WHERE activo = true ORDER BY orden ASC`
  );
  return r.rows;
}

export async function getAllAreaConfigViaClient(client: PoolClient): Promise<AreaConfigRow[]> {
  const r = await client.query<AreaConfigRow>(
    `SELECT ${FIELDS} FROM configuracion_areas WHERE activo = true ORDER BY orden ASC`
  );
  return r.rows;
}

/** IDs de áreas marcadas como paso final. */
export async function getFinalStepAreaIds(): Promise<number[]> {
  const r = await query<{ id: number }>(
    `SELECT id FROM configuracion_areas WHERE activo = true AND es_paso_final = true ORDER BY orden ASC`
  );
  return r.rows.map((row) => row.id);
}

export async function getFinalStepAreaIdsViaClient(client: PoolClient): Promise<number[]> {
  const r = await client.query<{ id: number }>(
    `SELECT id FROM configuracion_areas WHERE activo = true AND es_paso_final = true ORDER BY orden ASC`
  );
  return r.rows.map((row) => row.id);
}

/** @deprecated Usar getFinalStepAreaIds */
export async function getFinalStepAreas(): Promise<number[]> {
  return getFinalStepAreaIds();
}

/** @deprecated Usar getFinalStepAreaIdsViaClient */
export async function getFinalStepAreasViaClient(client: PoolClient): Promise<number[]> {
  return getFinalStepAreaIdsViaClient(client);
}

export async function getHighAmountNotifyAreaIds(): Promise<number[]> {
  const r = await query<{ id: number }>(
    `SELECT id FROM configuracion_areas WHERE activo = true AND notificar_monto_alto = true ORDER BY orden ASC`
  );
  return r.rows.map((row) => row.id);
}

export async function getSigningAreaIds(): Promise<number[]> {
  const r = await query<{ id: number }>(
    `SELECT id FROM configuracion_areas WHERE activo = true AND permite_firma = true ORDER BY orden ASC`
  );
  return r.rows.map((row) => row.id);
}

export async function getCanCompleteAreaIds(): Promise<number[]> {
  const r = await query<{ id: number }>(
    `SELECT id FROM configuracion_areas WHERE activo = true AND puede_completar_tramite = true ORDER BY orden ASC`
  );
  return r.rows.map((row) => row.id);
}

export async function getCanCompleteCaseAreaIdsViaClient(client: PoolClient): Promise<number[]> {
  const r = await client.query<{ id: number }>(
    `SELECT id FROM configuracion_areas WHERE activo = true AND puede_completar_tramite = true ORDER BY orden ASC`
  );
  return r.rows.map((row) => row.id);
}

export async function areaAllowsSigningByAreaId(areaId: number): Promise<boolean> {
  const r = await query<{ permite_firma: boolean }>(
    `SELECT permite_firma FROM configuracion_areas WHERE id = $1 AND activo = true`,
    [areaId]
  );
  return r.rows[0]?.permite_firma === true;
}

/** Compatibilidad: validación al asignar usuario de área (usa id numérico). */
export async function areaAllowsSigning(areaId: number): Promise<boolean> {
  return areaAllowsSigningByAreaId(areaId);
}

/**
 * Área donde un usuario de área puede tener «puede firmar» en la app:
 * firma de documentos (Legal) o cierre / firma de Director General.
 * Debe coincidir con la lógica de `resolveSignerAreaId` y la sesión (`isSigningArea` / `isFinalStepArea`).
 */
export async function areaSupportsUserSigning(areaId: number): Promise<boolean> {
  const r = await query<{ pf: boolean; pct: boolean | null }>(
    `SELECT permite_firma AS pf, puede_completar_tramite AS pct
     FROM configuracion_areas WHERE id = $1 AND activo = true`,
    [areaId]
  );
  const row = r.rows[0];
  if (!row) return false;
  if (row.pct === true) return true;
  return row.pf === true;
}

export async function getAreaNombreById(areaId: number): Promise<string | null> {
  const r = await query<{ nombre_area: string }>(
    `SELECT nombre_area FROM configuracion_areas WHERE id = $1`,
    [areaId]
  );
  return r.rows[0]?.nombre_area ?? null;
}
