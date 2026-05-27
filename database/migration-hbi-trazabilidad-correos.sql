-- Trazabilidad HBI: vincular correos enviados a operaciones + dirección en bandeja
-- Ejecutar tras schema-hbi: npm run db:migrate-hbi-trazabilidad

ALTER TABLE correos_enviados
  ADD COLUMN IF NOT EXISTS operacion_id UUID REFERENCES operaciones_credito(id) ON DELETE SET NULL;

ALTER TABLE correos_enviados
  ADD COLUMN IF NOT EXISTS codigo_operacion VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_correos_enviados_operacion
  ON correos_enviados (operacion_id, creado_en DESC)
  WHERE operacion_id IS NOT NULL;

ALTER TABLE correos_operacion
  ADD COLUMN IF NOT EXISTS direccion VARCHAR(16) NOT NULL DEFAULT 'RECIBIDO';

ALTER TABLE correos_operacion
  ADD COLUMN IF NOT EXISTS correo_enviado_id UUID;

ALTER TABLE correos_operacion
  ADD COLUMN IF NOT EXISTS enviado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE correos_operacion
  ADD COLUMN IF NOT EXISTS destinatario_principal VARCHAR(320);

CREATE INDEX IF NOT EXISTS idx_correos_operacion_direccion
  ON correos_operacion (operacion_id, direccion, recibido_en DESC);

COMMENT ON COLUMN correos_operacion.direccion IS 'RECIBIDO = bandeja entrante; ENVIADO = copia en expediente del correo saliente';
