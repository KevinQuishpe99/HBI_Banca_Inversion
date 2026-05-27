-- HTML en auditoría de correos + texto en configuracion_app para plantilla.
-- Ejecutar: npm run db:migrate-email-log-html-template

ALTER TABLE configuracion_app
  ADD COLUMN IF NOT EXISTS valor_texto TEXT;

ALTER TABLE correos_enviados
  ADD COLUMN IF NOT EXISTS cuerpo_html TEXT;

ALTER TABLE correos_enviados
  ADD COLUMN IF NOT EXISTS envio_lote_id UUID;

CREATE INDEX IF NOT EXISTS idx_correos_enviados_lote ON correos_enviados (envio_lote_id)
  WHERE envio_lote_id IS NOT NULL;
