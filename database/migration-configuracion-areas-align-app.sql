-- =============================================================================
-- Alinea public.configuracion_areas con la aplicación actual:
--   - nombre  → nombre_area (si aún existe nombre)
--   - elimina columna codigo (identificador = id numérico)
-- Idempotente: se puede ejecutar varias veces sin error.
-- Uso: npm run db:migrate-configuracion-areas-align
-- =============================================================================

-- 1) Texto visible: nombre → nombre_area
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'configuracion_areas'
      AND column_name = 'nombre'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'configuracion_areas'
      AND column_name = 'nombre_area'
  ) THEN
    ALTER TABLE public.configuracion_areas RENAME COLUMN nombre TO nombre_area;
    RAISE NOTICE 'Renombrado configuracion_areas.nombre → nombre_area';
  ELSE
    RAISE NOTICE 'Omitido rename nombre→nombre_area (ya está alineado o falta nombre)';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'configuracion_areas'
      AND column_name = 'nombre_area'
  ) THEN
    EXECUTE $c$
      COMMENT ON COLUMN public.configuracion_areas.nombre_area IS 'Nombre descriptivo del área (UI)'
    $c$;
  END IF;
END $$;

-- 2) Quitar restricciones UNIQUE conocidas sobre codigo (nombres históricos)
ALTER TABLE public.configuracion_areas DROP CONSTRAINT IF EXISTS configuracion_areas_codigo_key;
ALTER TABLE public.configuracion_areas DROP CONSTRAINT IF EXISTS area_config_area_key;

-- 3) Cualquier otra UNIQUE que incluya solo codigo (por si el nombre difiere)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class cl ON c.conrelid = cl.oid
    JOIN pg_namespace n ON cl.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND cl.relname = 'configuracion_areas'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%codigo%'
  LOOP
    EXECUTE format('ALTER TABLE public.configuracion_areas DROP CONSTRAINT IF EXISTS %I', r.conname);
    RAISE NOTICE 'Eliminada restricción única: %', r.conname;
  END LOOP;
END $$;

-- 4) Columna codigo
ALTER TABLE public.configuracion_areas DROP COLUMN IF EXISTS codigo;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'configuracion_areas'
      AND column_name = 'codigo'
  ) THEN
    RAISE EXCEPTION 'No se pudo eliminar configuracion_areas.codigo; revise dependencias (vistas/FK).';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'configuracion_areas'
      AND column_name = 'nombre_area'
  ) THEN
    RAISE EXCEPTION 'Falta configuracion_areas.nombre_area: renombre manualmente o restaure desde backup.';
  END IF;
END $$;
