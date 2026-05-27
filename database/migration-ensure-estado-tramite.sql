BEGIN;

DROP VIEW IF EXISTS vista_tramites_creador CASCADE;

DO $b$
BEGIN
  CREATE TYPE estado_tramite AS ENUM (
    'TRAMITE_ENVIADO',
    'EN_REVISION',
    'REVISADO',
    'DEVUELTO',
    'TRAMITE_COMPLETADO'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $b$;

DO $b$
DECLARE
  typ text;
BEGIN
  IF to_regclass('public.tramites') IS NULL THEN
    RETURN;
  END IF;

  SELECT t.typname INTO typ
  FROM pg_attribute a
  JOIN pg_type t ON a.atttypid = t.oid
  WHERE a.attrelid = 'tramites'::regclass
    AND a.attname = 'estado'
    AND a.attnum > 0
    AND NOT a.attisdropped
  LIMIT 1;

  IF typ IS NULL OR typ = 'estado_tramite' THEN
    RETURN;
  END IF;

  IF typ = 'case_status' THEN
    ALTER TABLE tramites ALTER COLUMN estado DROP DEFAULT;
    ALTER TABLE tramites
      ALTER COLUMN estado TYPE estado_tramite
      USING (
        CASE estado::text
          WHEN 'SUBMITTED' THEN 'TRAMITE_ENVIADO'::estado_tramite
          WHEN 'IN_REVIEW' THEN 'EN_REVISION'::estado_tramite
          WHEN 'APPROVED' THEN 'REVISADO'::estado_tramite
          WHEN 'RETURNED' THEN 'DEVUELTO'::estado_tramite
          WHEN 'COMPLETED' THEN 'TRAMITE_COMPLETADO'::estado_tramite
          ELSE 'TRAMITE_ENVIADO'::estado_tramite
        END
      );
    ALTER TABLE tramites ALTER COLUMN estado SET DEFAULT 'TRAMITE_ENVIADO'::estado_tramite;
    RETURN;
  END IF;

  ALTER TABLE tramites ALTER COLUMN estado DROP DEFAULT;
  ALTER TABLE tramites
    ALTER COLUMN estado TYPE estado_tramite
    USING (
      CASE trim(estado::text)
        WHEN 'SUBMITTED' THEN 'TRAMITE_ENVIADO'::estado_tramite
        WHEN 'IN_REVIEW' THEN 'EN_REVISION'::estado_tramite
        WHEN 'APPROVED' THEN 'REVISADO'::estado_tramite
        WHEN 'RETURNED' THEN 'DEVUELTO'::estado_tramite
        WHEN 'COMPLETED' THEN 'TRAMITE_COMPLETADO'::estado_tramite
        WHEN 'TRAMITE_ENVIADO' THEN 'TRAMITE_ENVIADO'::estado_tramite
        WHEN 'EN_REVISION' THEN 'EN_REVISION'::estado_tramite
        WHEN 'REVISADO' THEN 'REVISADO'::estado_tramite
        WHEN 'DEVUELTO' THEN 'DEVUELTO'::estado_tramite
        WHEN 'TRAMITE_COMPLETADO' THEN 'TRAMITE_COMPLETADO'::estado_tramite
        ELSE 'TRAMITE_ENVIADO'::estado_tramite
      END
    );
  ALTER TABLE tramites ALTER COLUMN estado SET DEFAULT 'TRAMITE_ENVIADO'::estado_tramite;
END $b$;

CREATE OR REPLACE VIEW vista_tramites_creador AS
SELECT
  t.*,
  u.nombre || ' ' || u.apellido AS nombre_creador,
  u.email AS email_creador,
  (SELECT COUNT(*) FROM archivos WHERE tramite_id = t.id AND eliminado = false) AS cantidad_archivos,
  (SELECT COUNT(*) FROM comentarios WHERE tramite_id = t.id) AS cantidad_comentarios
FROM tramites t
JOIN usuarios u ON t.creado_por = u.id;

COMMIT;
