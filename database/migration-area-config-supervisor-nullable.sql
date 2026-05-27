-- Permite crear filas en area_config sin supervisor (alta desde admin mínima).
-- Si migration-area-supervisor-1-1.sql aplicó NOT NULL cuando no había NULLs, esto lo revierte de forma segura.
ALTER TABLE area_config ALTER COLUMN supervisor_id DROP NOT NULL;
