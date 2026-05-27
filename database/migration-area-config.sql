-- ============================================
-- MIGRACIÓN: Configuración de áreas (labels, seleccionables, obligatorias)
-- ============================================

-- Requiere que exista el enum user_area (de migration-roles-areas.sql)
-- y que ya se haya agregado DIRECTOR_GENERAL (de migration-parallel-areas-director.sql)

CREATE TABLE IF NOT EXISTS area_config (
  area user_area PRIMARY KEY,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_selectable BOOLEAN NOT NULL DEFAULT false,
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE area_config IS 'Catálogo de áreas con labels y reglas de selección del flujo.';
COMMENT ON COLUMN area_config.is_selectable IS 'Si el usuario puede escoger esta área en la creación del trámite.';
COMMENT ON COLUMN area_config.is_mandatory IS 'Si esta área siempre debe revisarse (ej: Legal, Director General).';

-- Upsert de configuraciones base
INSERT INTO area_config (area, label, is_selectable, is_mandatory, sort_order)
VALUES
  ('COMERCIAL', 'Comercial', true, false, 10),
  ('TECNICA', 'Técnica', true, false, 20),
  ('FINANCIERA', 'Financiera', true, false, 30),
  ('LEGAL', 'Legal', false, true, 90),
  ('DIRECTOR_GENERAL', 'Director General', false, true, 100)
ON CONFLICT (area) DO UPDATE
SET label = EXCLUDED.label,
    is_selectable = EXCLUDED.is_selectable,
    is_mandatory = EXCLUDED.is_mandatory,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

