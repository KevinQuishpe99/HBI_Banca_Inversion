-- Unificar etiquetas de UI: Pendiente (SUBMITTED, IN_REVIEW, APPROVED), Devuelto, Trámite completado.
-- Ejecutar en entornos que ya tienen case_status_config poblada.

UPDATE case_status_config
SET label = 'Pendiente', variant = 'yellow', updated_at = CURRENT_TIMESTAMP
WHERE code IN ('SUBMITTED', 'IN_REVIEW', 'APPROVED');

UPDATE case_status_config
SET label = 'Devuelto', variant = 'orange', updated_at = CURRENT_TIMESTAMP
WHERE code = 'RETURNED';

UPDATE case_status_config
SET label = 'Trámite completado', variant = 'emerald', updated_at = CURRENT_TIMESTAMP
WHERE code = 'COMPLETED';
