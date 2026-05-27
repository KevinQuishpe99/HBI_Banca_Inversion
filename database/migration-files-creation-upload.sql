-- Archivos subidos al crear el trámite no se pueden eliminar (solo metadatos editables en el caso)
ALTER TABLE files ADD COLUMN IF NOT EXISTS is_creation_upload BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN files.is_creation_upload IS 'true si el archivo se subió al crear el trámite; no eliminable';

-- Retrocompatibilidad: marcar archivos que coinciden con los nombres guardados en el trámite al crearlo
UPDATE files f
SET is_creation_upload = true
FROM cases c
WHERE f.case_id = c.id
  AND f.is_deleted = false
  AND c.document_file_name IS NOT NULL
  AND TRIM(c.document_file_name) <> ''
  AND EXISTS (
    SELECT 1
    FROM unnest(string_to_array(c.document_file_name, ',')) AS part(name)
    WHERE TRIM(part.name) = f.file_name
  );
