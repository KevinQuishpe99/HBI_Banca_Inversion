-- ============================================
-- MIGRACIÓN: Catálogos configurables (sin hardcode)
-- - Tipos de documento
-- - Tipos de firma
-- - Tipos de plantilla
-- ============================================

CREATE TABLE IF NOT EXISTS document_type_config (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS signature_type_config (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS template_type_config (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Valores iniciales (puedes editarlos desde BD)
INSERT INTO document_type_config (code, label, sort_order) VALUES
  ('CONTRATO', 'Contrato', 10),
  ('CONVENIO', 'Convenio', 20),
  ('ACUERDO', 'Acuerdo', 30),
  ('OTRO', 'Otro', 99)
ON CONFLICT (code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO signature_type_config (code, label, sort_order) VALUES
  ('FISICA', 'Física', 10),
  ('ELECTRONICA', 'Electrónica', 20)
ON CONFLICT (code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO template_type_config (code, label, sort_order) VALUES
  ('PLANTILLA_COMWARE', 'Plantilla Comware', 10),
  ('PLANTILLA_CLIENTE', 'Plantilla Cliente', 20),
  ('PLANTILLA_PROVEEDOR', 'Plantilla Proveedor', 30)
ON CONFLICT (code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

