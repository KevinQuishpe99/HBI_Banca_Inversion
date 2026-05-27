-- Tras renombrar updated_at → actualizado_en, el trigger sigue llamando NEW.updated_at.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $fn$
BEGIN
  IF TG_TABLE_SCHEMA = 'public' AND TG_TABLE_NAME IN (
    'usuarios', 'tramites', 'comentarios', 'configuracion_app'
  ) THEN
    NEW.actualizado_en := CURRENT_TIMESTAMP;
  ELSE
    NEW.updated_at := CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;
