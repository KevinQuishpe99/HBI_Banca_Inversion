/**
 * Valores del ENUM PostgreSQL `estado_tramite` (español, ASCII; sin tildes; ñ como "ni" en otros identificadores del esquema).
 * La app usa `CaseStatus` en inglés y mapea con `estado-tramite-map.ts`.
 */
export const EstadoTramite = {
  TRAMITE_ENVIADO: 'TRAMITE_ENVIADO',
  EN_REVISION: 'EN_REVISION',
  REVISADO: 'REVISADO',
  DEVUELTO: 'DEVUELTO',
  TRAMITE_COMPLETADO: 'TRAMITE_COMPLETADO',
} as const;
