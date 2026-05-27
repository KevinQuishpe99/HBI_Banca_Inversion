-- Amplía la lista de nombres de archivos del trámite (varios PDF separados por coma).
-- Antes: VARCHAR(255) → error 22001 con 4+ archivos de nombre largo.
-- Ahora: VARCHAR(8000) (más margen si suben muchos archivos).
-- Idempotente: seguro ejecutar más de una vez.

DROP VIEW IF EXISTS public.vista_tramites_creador CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tramites'
      AND column_name = 'nombre_archivo_documento'
  ) THEN
    ALTER TABLE tramites
      ALTER COLUMN nombre_archivo_documento TYPE VARCHAR(8000)
      USING LEFT(nombre_archivo_documento::TEXT, 8000);
    COMMENT ON COLUMN tramites.nombre_archivo_documento IS
      'Nombres de documentos al crear el trámite (separados por coma, máx. 8000 caracteres).';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cases'
      AND column_name = 'document_file_name'
  ) THEN
    ALTER TABLE cases
      ALTER COLUMN document_file_name TYPE VARCHAR(8000)
      USING LEFT(document_file_name::TEXT, 8000);
  END IF;
END $$;

CREATE OR REPLACE VIEW public.vista_tramites_creador AS
SELECT
  t.*,
  u.nombre || ' ' || u.apellido AS nombre_creador,
  u.email AS email_creador,
  (SELECT COUNT(*) FROM archivos WHERE tramite_id = t.id AND eliminado = false) AS cantidad_archivos,
  (SELECT COUNT(*) FROM comentarios WHERE tramite_id = t.id) AS cantidad_comentarios
FROM tramites t
JOIN usuarios u ON t.creado_por = u.id;
