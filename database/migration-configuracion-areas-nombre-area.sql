-- Renombra la columna de texto visible del catálogo de áreas: nombre → nombre_area.
-- Preferir la migración idempotente que también quita `codigo`:
--   npm run db:migrate-configuracion-areas-align
--   (archivo: migration-configuracion-areas-align-app.sql)

ALTER TABLE configuracion_areas RENAME COLUMN nombre TO nombre_area;

COMMENT ON COLUMN configuracion_areas.nombre_area IS 'Nombre descriptivo del área (UI)';
