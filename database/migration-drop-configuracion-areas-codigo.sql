-- Elimina la columna codigo de configuracion_areas (identificador = id numérico).
-- Preferir: npm run db:migrate-configuracion-areas-align (incluye nombre→nombre_area + quitar codigo).
-- Aplicar tras desplegar código que ya no referencia codigo.

ALTER TABLE configuracion_areas DROP CONSTRAINT IF EXISTS configuracion_areas_codigo_key;
ALTER TABLE configuracion_areas DROP CONSTRAINT IF EXISTS area_config_area_key;
ALTER TABLE configuracion_areas DROP COLUMN IF EXISTS codigo;
