/**
 * Etiquetas en español para el estado del trámite.
 * En BD el trámite referencia `configuracion_estados` vía `tramites.estado_id`; en la app se usa `CaseStatus` (inglés) y se mapea en `estado-tramite-map.ts`.
 */
export const CASE_STATUS_LABEL_ES: Record<string, { label: string; variant: string }> = {
  TRAMITE_ENVIADO: { label: 'Pendiente', variant: 'yellow' },
  EN_REVISION: { label: 'Pendiente', variant: 'yellow' },
  REVISADO: { label: 'Pendiente', variant: 'yellow' },
  DEVUELTO: { label: 'Devuelto', variant: 'orange' },
  TRAMITE_COMPLETADO: { label: 'Trámite completado', variant: 'emerald' },
  SUBMITTED: { label: 'Pendiente', variant: 'yellow' },
  IN_REVIEW: { label: 'Pendiente', variant: 'yellow' },
  APPROVED: { label: 'Pendiente', variant: 'yellow' },
  RETURNED: { label: 'Devuelto', variant: 'orange' },
  COMPLETED: { label: 'Trámite completado', variant: 'emerald' },
};

/** Lecturas antiguas o auditoría con códigos ya no usados en el flujo */
export function caseStatusLabelEs(code: string): string {
  if (code === 'DRAFT') return 'Trámite enviado';
  if (code === 'REJECTED') return 'Devuelto';
  if (code === 'CANCELLED') return 'Trámite cerrado';
  return CASE_STATUS_LABEL_ES[code]?.label ?? code;
}
