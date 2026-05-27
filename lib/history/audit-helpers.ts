import type { AuditLogWithUser } from '@/types/history.types';

/** Normaliza `audit.new_value` (JSONB u objeto) a un registro legible. */
export function parseAuditNewValueRecord(audit: AuditLogWithUser): Record<string, unknown> | null {
  const nv = audit.newValue as unknown;
  if (nv == null) return null;
  if (typeof nv === 'string') {
    try {
      const j = JSON.parse(nv) as unknown;
      return typeof j === 'object' && j !== null && !Array.isArray(j) ? (j as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  if (typeof nv === 'object' && nv !== null && !Array.isArray(nv)) {
    return nv as Record<string, unknown>;
  }
  return null;
}

/** Sustitución de contenido en devolución (mismo `file_id`) vs subida nueva. */
export function auditIsFileReplacement(audit: AuditLogWithUser): boolean {
  return parseAuditNewValueRecord(audit)?.replaced === true;
}

/** Reenvío tras devolución: enum `RESUBMITTED` o fallback `SUBMITTED` + `resubmittedAfterReturn` (BD sin migración). */
export function auditIsResubmitEvent(audit: AuditLogWithUser): boolean {
  if (audit.action === 'RESUBMITTED') return true;
  if (audit.action === 'SUBMITTED') {
    const nv = parseAuditNewValueRecord(audit);
    return nv?.resubmittedAfterReturn === true || nv?.resubmitted_after_return === true;
  }
  return false;
}

const timeMs = (a: AuditLogWithUser) => new Date(a.createdAt as unknown as string).getTime();

/** Inicio del periodo «preparando este reenvío»: lo más tardío entre última devolución y reenvío anterior. */
function lowerBoundMsBeforeResubmit(sorted: AuditLogWithUser[], resubmitAt: number): number | null {
  let lastReturn = -Infinity;
  let lastPrevResubmit = -Infinity;
  for (const h of sorted) {
    const ht = timeMs(h);
    if (Number.isNaN(ht) || ht >= resubmitAt) continue;
    if (h.action === 'RETURNED' && ht > lastReturn) lastReturn = ht;
    if (auditIsResubmitEvent(h) && ht > lastPrevResubmit) lastPrevResubmit = ht;
  }
  const lower = Math.max(lastReturn, lastPrevResubmit);
  if (lower === -Infinity) return null;
  return lower;
}

/**
 * Subidas/actualizaciones en el periodo de este reenvío (tras la devolución / ciclo anterior): van en el recuadro
 * «Reenviado»; no se muestran como tarjetas sueltas.
 */
export function fileUploadAuditIdsConsolidatedIntoResubmit(hist: AuditLogWithUser[]): Set<string> {
  const ids = new Set<string>();
  if (hist.length === 0) return ids;
  const sorted = [...hist].sort((a, b) => timeMs(a) - timeMs(b));
  const resubmits = sorted.filter((h) => auditIsResubmitEvent(h));
  for (const s of resubmits) {
    const st = timeMs(s);
    if (Number.isNaN(st)) continue;
    const lower = lowerBoundMsBeforeResubmit(sorted, st);
    if (lower == null) continue;
    for (const h of sorted) {
      if (h.action !== 'FILE_UPLOADED') continue;
      const ht = timeMs(h);
      if (Number.isNaN(ht)) continue;
      if (ht > lower && ht < st) ids.add(h.id);
    }
  }
  return ids;
}
