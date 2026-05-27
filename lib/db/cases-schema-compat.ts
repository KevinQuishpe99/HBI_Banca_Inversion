/**
 * Post-migración FK: `tramites.estado_id` → `configuracion_estados.id`.
 * Los fragmentos son literales enteros para SQL (sin comillas).
 */

export type CasesSchemaMode = 'estado_fk';

export async function resolveCasesSchemaMode(): Promise<CasesSchemaMode> {
  return 'estado_fk';
}

export function resetCasesSchemaModeCache(): void {
  // Sin caché dual
}

export async function casesStateColumn(): Promise<'estado_id'> {
  return 'estado_id';
}

export type CaseStateFragmentKey =
  | 'tramiteEnviado'
  | 'enRevision'
  | 'revisado'
  | 'devuelto'
  | 'tramiteCompletado';

type CaseStateFragments = {
  tramiteEnviado: string;
  enRevision: string;
  revisado: string;
  devuelto: string;
  tramiteCompletado: string;
};

const FRAGMENTS: CaseStateFragments = {
  tramiteEnviado: '1',
  enRevision: '2',
  revisado: '3',
  devuelto: '4',
  tramiteCompletado: '5',
};

export async function getCasesStateSql(): Promise<{
  mode: CasesSchemaMode;
  column: 'estado_id';
  fr: CaseStateFragments;
}> {
  return { mode: 'estado_fk', column: 'estado_id', fr: FRAGMENTS };
}

export async function caseStateSetExpr(which: CaseStateFragmentKey): Promise<string> {
  return FRAGMENTS[which];
}
