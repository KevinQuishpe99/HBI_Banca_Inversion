-- configuracion_estados: clave primaria numérica (id) y sin columna codigo.
-- El valor del enum estado_tramite queda en valor_tramite (TEXT UNIQUE), alineado con tramites.estado.
-- Idempotente: si ya existe valor_tramite y PK en id, los pasos intermedios se omiten de forma segura.
-- Ejecutar: npm run db:migrate-configuracion-estados-id-pk

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'configuracion_estados'
  ) THEN
    RAISE EXCEPTION 'No existe public.configuracion_estados; aplique antes las migraciones base.';
  END IF;
END $$;

-- 1) Columna id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'configuracion_estados' AND column_name = 'id'
  ) THEN
    ALTER TABLE public.configuracion_estados ADD COLUMN id SERIAL;
  END IF;
END $$;

-- 2) Quitar PK sobre codigo/code y renombrar a valor_tramite
DO $$
DECLARE
  pk_name text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'configuracion_estados' AND column_name = 'valor_tramite'
  ) THEN
    NULL;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'configuracion_estados' AND column_name = 'codigo'
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'configuracion_estados' AND column_name = 'code'
  ) THEN
    SELECT c.conname INTO pk_name
    FROM pg_constraint c
    WHERE c.conrelid = 'public.configuracion_estados'::regclass AND c.contype = 'p'
    LIMIT 1;
    IF pk_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.configuracion_estados DROP CONSTRAINT %I', pk_name);
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'configuracion_estados' AND column_name = 'codigo'
    ) THEN
      ALTER TABLE public.configuracion_estados RENAME COLUMN codigo TO valor_tramite;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'configuracion_estados' AND column_name = 'code'
    ) THEN
      ALTER TABLE public.configuracion_estados RENAME COLUMN code TO valor_tramite;
    END IF;
  END IF;
END $$;

ALTER TABLE public.configuracion_estados ALTER COLUMN id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.configuracion_estados'::regclass AND c.contype = 'p'
  ) THEN
    ALTER TABLE public.configuracion_estados
      ADD CONSTRAINT configuracion_estados_pkey PRIMARY KEY (id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_configuracion_estados_valor_tramite
  ON public.configuracion_estados (valor_tramite);
