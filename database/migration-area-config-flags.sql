-- Nuevos flags en area_config para eliminar lógica hardcodeada.
-- is_final_step:          área "final" del flujo (antes hardcodeado a LEGAL / DIRECTOR_GENERAL)
-- notify_on_high_amount:  recibe alerta cuando un trámite declara monto ≥ umbral
-- allows_signing:         usuarios de esta área pueden firmar documentos
-- can_complete_case:      esta área puede marcar un trámite como completado

ALTER TABLE area_config
  ADD COLUMN IF NOT EXISTS is_final_step         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_on_high_amount BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allows_signing        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_complete_case     BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN area_config.is_final_step         IS 'Área final del flujo de revisión (se antepone en DIRECT_LEGAL, va al final en SUPERVISION_CHAIN).';
COMMENT ON COLUMN area_config.notify_on_high_amount IS 'Recibe notificación/correo cuando un trámite alcanza el umbral de monto.';
COMMENT ON COLUMN area_config.allows_signing        IS 'Usuarios de esta área pueden firmar documentos del trámite.';
COMMENT ON COLUMN area_config.can_complete_case     IS 'Esta área puede cerrar/completar un trámite directamente.';

-- Valores iniciales coherentes con la lógica que antes estaba hardcodeada.
UPDATE area_config SET is_final_step = true         WHERE area IN ('LEGAL', 'DIRECTOR_GENERAL');
UPDATE area_config SET notify_on_high_amount = true WHERE area IN ('COMERCIAL', 'LEGAL', 'DIRECTOR_GENERAL');
UPDATE area_config SET allows_signing = true        WHERE area IN ('LEGAL', 'DIRECTOR_GENERAL');
UPDATE area_config SET can_complete_case = true     WHERE area IN ('LEGAL', 'DIRECTOR_GENERAL');
