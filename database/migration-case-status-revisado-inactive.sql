-- Oculta el estado REVISADO en listados y meta (/api/meta/case-statuses filtra is_active).
-- El valor sigue existiendo en el ENUM por si hay datos históricos; el badge usa fallback a "Pendiente".

UPDATE case_status_config
SET is_active = false,
    updated_at = CURRENT_TIMESTAMP
WHERE code = 'REVISADO';
