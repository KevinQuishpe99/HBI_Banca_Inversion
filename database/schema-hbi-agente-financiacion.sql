-- =============================================================================
-- HBI — Agente de Financiación (Workflow)
-- Esquema independiente para operaciones de crédito sindicado.
-- Convención: snake_case, comentarios en español, sin tildes en identificadores.
-- =============================================================================

-- Fases del flujo operativo (documento Mayo 2026)
CREATE TYPE fase_workflow_hbi AS ENUM (
  'FASE_1_CONTRATOS',
  'FASE_2_CORREOS',
  'FASE_3_EXPEDIENTE',
  'FASE_4_SEGUIMIENTO'
);

-- Servicios posibles por crédito (Anexos 1, 2 y 3)
CREATE TYPE tipo_servicio_hbi AS ENUM (
  'ANEXO_1_ADMINISTRATIVO',
  'ANEXO_2_GARANTIAS',
  'ANEXO_3_CALCULO'
);

-- Clasificación de documentos contractuales
CREATE TYPE tipo_documento_contractual AS ENUM (
  'CONTRATO_MARCO',
  'ANEXO_1',
  'ANEXO_2',
  'ANEXO_3',
  'CRONOGRAMA',
  'GARANTIA',
  'OTRO'
);

-- Origen del correo en la bandeja por operación
CREATE TYPE origen_correo_hbi AS ENUM (
  'AGENTE_HBI',
  'DEUDOR',
  'ACREEDOR',
  'OTRO'
);

CREATE TYPE prioridad_correo_hbi AS ENUM (
  'BAJA',
  'MEDIA',
  'ALTA',
  'URGENTE'
);

CREATE TYPE estado_actividad_hbi AS ENUM (
  'PENDIENTE',
  'EN_PROGRESO',
  'COMPLETADA',
  'BLOQUEADA',
  'CANCELADA'
);

-- -----------------------------------------------------------------------------
-- Operación / crédito (expediente maestro)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS operaciones_credito (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_operacion VARCHAR(50) UNIQUE NOT NULL,
  nombre_credito VARCHAR(500) NOT NULL,
  descripcion TEXT,
  deudor VARCHAR(300),
  agente_financiacion VARCHAR(300) DEFAULT 'HBI',
  fase_actual fase_workflow_hbi NOT NULL DEFAULT 'FASE_1_CONTRATOS',
  servicios_activos tipo_servicio_hbi[] NOT NULL DEFAULT '{}',
  responsable_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  metadata JSONB DEFAULT '{}',
  alertas_activas BOOLEAN DEFAULT false,
  proximos_pasos TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cerrado_en TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_operaciones_fase ON operaciones_credito(fase_actual);
CREATE INDEX IF NOT EXISTS idx_operaciones_codigo ON operaciones_credito(codigo_operacion);
CREATE INDEX IF NOT EXISTS idx_operaciones_responsable ON operaciones_credito(responsable_id);

-- -----------------------------------------------------------------------------
-- Fase 1: documentos contractuales por operación
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documentos_contractuales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operacion_id UUID NOT NULL REFERENCES operaciones_credito(id) ON DELETE CASCADE,
  tipo_documento tipo_documento_contractual NOT NULL,
  nombre_archivo VARCHAR(500) NOT NULL,
  mime_type VARCHAR(120),
  tamano_bytes BIGINT,
  blob_url TEXT,
  blob_path TEXT,
  datos_extraidos JSONB DEFAULT '{}',
  clasificacion_confianza NUMERIC(5,2),
  subido_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_docs_contractuales_operacion ON documentos_contractuales(operacion_id);
CREATE INDEX IF NOT EXISTS idx_docs_contractuales_tipo ON documentos_contractuales(tipo_documento);

-- -----------------------------------------------------------------------------
-- Fase 2: bandeja de correos por operación
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS correos_operacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operacion_id UUID NOT NULL REFERENCES operaciones_credito(id) ON DELETE CASCADE,
  message_id_externo VARCHAR(500),
  remitente VARCHAR(320) NOT NULL,
  destinatarios TEXT[],
  asunto VARCHAR(1000) NOT NULL,
  cuerpo_resumen TEXT,
  cuerpo_html TEXT,
  origen origen_correo_hbi NOT NULL DEFAULT 'OTRO',
  prioridad prioridad_correo_hbi NOT NULL DEFAULT 'MEDIA',
  leido BOOLEAN DEFAULT false,
  vinculado_automatico BOOLEAN DEFAULT false,
  recibido_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_correos_operacion ON correos_operacion(operacion_id, recibido_en DESC);
CREATE INDEX IF NOT EXISTS idx_correos_prioridad ON correos_operacion(prioridad);

-- -----------------------------------------------------------------------------
-- Fase 3: expediente consolidado (vista 360 — datos estructurados)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expediente_maestro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operacion_id UUID NOT NULL UNIQUE REFERENCES operaciones_credito(id) ON DELETE CASCADE,
  resumen_contractual JSONB DEFAULT '{}',
  cronogramas JSONB DEFAULT '[]',
  responsables JSONB DEFAULT '[]',
  comunicaciones_resumen JSONB DEFAULT '{}',
  alertas JSONB DEFAULT '[]',
  consolidado_en TIMESTAMPTZ,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- Fase 4: actividades y seguimiento por tipo de servicio (Anexo)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS actividades_servicio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operacion_id UUID NOT NULL REFERENCES operaciones_credito(id) ON DELETE CASCADE,
  tipo_servicio tipo_servicio_hbi NOT NULL,
  titulo VARCHAR(500) NOT NULL,
  descripcion TEXT,
  estado estado_actividad_hbi NOT NULL DEFAULT 'PENDIENTE',
  orden INTEGER NOT NULL DEFAULT 0,
  fecha_limite TIMESTAMPTZ,
  asignado_a UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  completada_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_actividades_operacion ON actividades_servicio(operacion_id, tipo_servicio);
CREATE INDEX IF NOT EXISTS idx_actividades_estado ON actividades_servicio(estado);

-- Historial de cambios de fase y estado (trazabilidad)
CREATE TABLE IF NOT EXISTS historial_operacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operacion_id UUID NOT NULL REFERENCES operaciones_credito(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo_evento VARCHAR(80) NOT NULL,
  fase_anterior fase_workflow_hbi,
  fase_nueva fase_workflow_hbi,
  detalle JSONB DEFAULT '{}',
  comentario TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_historial_operacion ON historial_operacion(operacion_id, creado_en DESC);

-- Reglas de notificación / próximos pasos (motor operativo)
CREATE TABLE IF NOT EXISTS reglas_notificacion_hbi (
  id SERIAL PRIMARY KEY,
  fase fase_workflow_hbi,
  tipo_servicio tipo_servicio_hbi,
  codigo_regla VARCHAR(80) UNIQUE NOT NULL,
  titulo VARCHAR(300) NOT NULL,
  mensaje_plantilla TEXT NOT NULL,
  activa BOOLEAN DEFAULT true,
  orden INTEGER DEFAULT 0,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Trigger actualizado_en en operaciones
CREATE OR REPLACE FUNCTION hbi_actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_operaciones_actualizado ON operaciones_credito;
CREATE TRIGGER trg_operaciones_actualizado
  BEFORE UPDATE ON operaciones_credito
  FOR EACH ROW EXECUTE FUNCTION hbi_actualizar_timestamp();

DROP TRIGGER IF EXISTS trg_actividades_actualizado ON actividades_servicio;
CREATE TRIGGER trg_actividades_actualizado
  BEFORE UPDATE ON actividades_servicio
  FOR EACH ROW EXECUTE FUNCTION hbi_actualizar_timestamp();

-- Secuencia para código de operación (CRED-2026-00001)
CREATE SEQUENCE IF NOT EXISTS seq_codigo_operacion_hbi START 1;

CREATE OR REPLACE FUNCTION generar_codigo_operacion_hbi()
RETURNS TEXT AS $$
DECLARE
  anio TEXT := to_char(CURRENT_DATE, 'YYYY');
  seq_val BIGINT;
BEGIN
  seq_val := nextval('seq_codigo_operacion_hbi');
  RETURN 'CRED-' || anio || '-' || lpad(seq_val::text, 5, '0');
END;
$$ LANGUAGE plpgsql;
