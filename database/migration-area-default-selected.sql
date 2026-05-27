-- ============================================
-- MIGRACIÓN: área por defecto (preselección en creación)
-- ============================================

ALTER TABLE area_config
  ADD COLUMN IF NOT EXISTS is_default_selected BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN area_config.is_default_selected IS 'Si está activo y es seleccionable, se preselecciona al crear un trámite.';

