-- ============================================
-- MIGRACIÓN: Supervisor 1:1 por área (area_config.supervisor_id)
-- - supervisor_id único globalmente (un usuario solo puede supervisar un área)
-- - AREA_USER debe tener área (users.area NOT NULL)
-- - Validación: supervisor ∈ usuarios del área (trigger)
-- ============================================

ALTER TABLE area_config ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES users(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_area_config_supervisor_id_unique
  ON area_config(supervisor_id)
  WHERE supervisor_id IS NOT NULL;

-- Asignar un supervisor por área si ya hay usuarios de área (primer usuario por fecha de creación)
UPDATE area_config ac
SET supervisor_id = sub.id
FROM (
  SELECT DISTINCT ON (u.area::text) u.area::text AS area_key, u.id
  FROM users u
  WHERE u.role = 'AREA_USER' AND u.area IS NOT NULL
  ORDER BY u.area::text, u.created_at ASC
) sub
WHERE ac.area::text = sub.area_key
  AND ac.supervisor_id IS NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_area_required_when_area_user;
ALTER TABLE users ADD CONSTRAINT users_area_required_when_area_user
  CHECK (role::text IS DISTINCT FROM 'AREA_USER' OR area IS NOT NULL);

CREATE OR REPLACE FUNCTION area_config_supervisor_ok() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.supervisor_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = NEW.supervisor_id
      AND u.role = 'AREA_USER'
      AND u.area::text = NEW.area::text
  ) THEN
    RAISE EXCEPTION 'El supervisor debe ser un usuario de área asignado a esta área';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_area_config_supervisor_ok ON area_config;
CREATE TRIGGER trg_area_config_supervisor_ok
  BEFORE INSERT OR UPDATE OF supervisor_id, area ON area_config
  FOR EACH ROW EXECUTE FUNCTION area_config_supervisor_ok();

CREATE OR REPLACE FUNCTION users_supervisor_area_guard() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF EXISTS (
      SELECT 1 FROM area_config ac
      WHERE ac.supervisor_id = NEW.id
        AND (
          NEW.role::text IS DISTINCT FROM 'AREA_USER'
          OR NEW.area IS NULL
          OR ac.area::text IS DISTINCT FROM NEW.area::text
        )
    ) THEN
      RAISE EXCEPTION 'No puede cambiar el área ni el rol de un usuario que es supervisor de un área; reasigne el supervisor en Administración de áreas primero';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_supervisor_area_guard ON users;
CREATE TRIGGER trg_users_supervisor_area_guard
  BEFORE UPDATE OF role, area ON users
  FOR EACH ROW EXECUTE FUNCTION users_supervisor_area_guard();

-- Si todas las filas tienen supervisor, exigir NOT NULL en BD
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM area_config WHERE supervisor_id IS NULL) THEN
    ALTER TABLE area_config ALTER COLUMN supervisor_id SET NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN area_config.supervisor_id IS 'Usuario AREA_USER supervisor único del área; debe tener users.area = area_config.area';
