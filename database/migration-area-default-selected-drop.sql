-- ============================================
-- MIGRACIÓN: eliminar columna de área por defecto
-- ============================================

ALTER TABLE area_config
  DROP COLUMN IF EXISTS is_default_selected;

