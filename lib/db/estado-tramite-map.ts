import type { CaseStatus } from '@/types/case.types';

/**
 * IDs fijos en `configuracion_estados` (FK desde `tramites.estado_id`).
 * Deben coincidir con la migración `migration-tramites-estado-config-fk.sql`.
 */
export const TRAMITE_ESTADO_ID = {
  SUBMITTED: 1,
  IN_REVIEW: 2,
  APPROVED: 3,
  RETURNED: 4,
  COMPLETED: 5,
} as const;

const ID_TO_APP: Record<number, CaseStatus> = {
  1: 'SUBMITTED',
  2: 'IN_REVIEW',
  3: 'APPROVED',
  4: 'RETURNED',
  5: 'COMPLETED',
};

const APP_TO_ID: Record<CaseStatus, number> = {
  SUBMITTED: 1,
  IN_REVIEW: 2,
  APPROVED: 3,
  RETURNED: 4,
  COMPLETED: 5,
};

/** Valores enum antiguos u híbridos (solo lectura legada). */
const LEGACY_DB_STRING_TO_APP: Record<string, CaseStatus> = {
  TRAMITE_ENVIADO: 'SUBMITTED',
  EN_REVISION: 'IN_REVIEW',
  REVISADO: 'APPROVED',
  DEVUELTO: 'RETURNED',
  TRAMITE_COMPLETADO: 'COMPLETED',
  SUBMITTED: 'SUBMITTED',
  IN_REVIEW: 'IN_REVIEW',
  APPROVED: 'APPROVED',
  RETURNED: 'RETURNED',
  COMPLETED: 'COMPLETED',
};

function parseId(raw: string): number | null {
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

/** `estado_id` (número) o texto enum legado → CaseStatus */
export function dbEstadoTramiteToApp(db: string | number | null | undefined): CaseStatus {
  if (db == null || db === '') return 'SUBMITTED';
  if (typeof db === 'number' && Number.isFinite(db)) {
    return ID_TO_APP[db] ?? 'SUBMITTED';
  }
  const s = String(db);
  const asId = parseId(s);
  if (asId != null && LEGACY_DB_STRING_TO_APP[s] === undefined && ID_TO_APP[asId]) {
    return ID_TO_APP[asId];
  }
  if (LEGACY_DB_STRING_TO_APP[s]) return LEGACY_DB_STRING_TO_APP[s];
  return 'SUBMITTED';
}

/** CaseStatus → `tramites.estado_id` */
export function appCaseStatusToEstadoId(app: CaseStatus): number {
  return APP_TO_ID[app] ?? 1;
}

/**
 * Para meta/admin: expone `code` compatible con `StatusBadge` (CaseStatus en inglés).
 */
export function caseStatusCodeFromConfigEstadoId(id: number): CaseStatus {
  return ID_TO_APP[id] ?? 'SUBMITTED';
}
