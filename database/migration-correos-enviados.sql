-- Registro de auditoría de correos transaccionales (Microsoft Graph).
-- Ejecutar: npm run db:migrate-correos-enviados

CREATE TABLE IF NOT EXISTS correos_enviados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(64) NOT NULL,
  estado VARCHAR(16) NOT NULL CHECK (estado IN ('enviado', 'fallido')),
  destinatario_email VARCHAR(255) NOT NULL,
  destinatario_usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  remitente VARCHAR(255),
  asunto VARCHAR(500) NOT NULL,
  cuerpo_texto TEXT,
  usa_html BOOLEAN NOT NULL DEFAULT false,
  tramite_id UUID REFERENCES tramites(id) ON DELETE SET NULL,
  numero_tramite VARCHAR(64),
  mensaje_error TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_correos_enviados_creado_en ON correos_enviados (creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_correos_enviados_tipo ON correos_enviados (tipo);
CREATE INDEX IF NOT EXISTS idx_correos_enviados_destinatario ON correos_enviados (destinatario_email);
CREATE INDEX IF NOT EXISTS idx_correos_enviados_tramite ON correos_enviados (tramite_id) WHERE tramite_id IS NOT NULL;

COMMENT ON TABLE correos_enviados IS 'Auditoría de correos enviados por Graph (notificaciones transaccionales).';
