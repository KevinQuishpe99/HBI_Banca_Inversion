import { query } from '@/lib/db';

/** Banderas de la fila de área para permisos sin columna codigo. */
export type AreaRowFlags = {
  permite_firma: boolean;
  es_paso_final: boolean;
  puede_completar_tramite: boolean;
};

/**
 * Indica si el área puede actuar como firma de documentos (Legal), aunque también cierre el trámite en la misma fila.
 */
export function isLegalSigningSemantics(f: AreaRowFlags): boolean {
  return f.permite_firma === true;
}

/**
 * Indica si el área es de cierre tipo Director General (puede completar trámite).
 */
export function isDirectorGeneralSemantics(f: AreaRowFlags): boolean {
  return f.puede_completar_tramite === true;
}

export async function getAreaRowFlagsById(areaId: number): Promise<AreaRowFlags | null> {
  const r = await query<AreaRowFlags>(
    `SELECT permite_firma, es_paso_final, puede_completar_tramite
     FROM configuracion_areas WHERE id = $1 AND activo = true`,
    [areaId]
  );
  return r.rows[0] ?? null;
}
