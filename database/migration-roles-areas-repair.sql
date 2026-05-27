-- ============================================
-- MIGRACIÓN (REPARACIÓN): Roles simplificados + área (idempotente)
-- ============================================
-- Caso objetivo:
-- - user_area ya existe
-- - users.role aún es el enum antiguo user_role (con COMERCIAL/TECNICA/...)
-- - necesitamos pasar a user_role_new (USER/AREA_USER/ADMIN) + users.area user_area

DO $$
BEGIN
  -- 1) Crear ENUM user_role_new si no existe
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_new') THEN
    CREATE TYPE user_role_new AS ENUM ('USER','AREA_USER','ADMIN');
  END IF;

  -- 2) Asegurar columna users.area
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND column_name='area'
  ) THEN
    ALTER TABLE users ADD COLUMN area user_area;
  END IF;

  -- 3) Si users.role ya es user_role_new, no hacer nada más
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND column_name='role'
      AND udt_name = 'user_role_new'
  ) THEN
    RETURN;
  END IF;

  -- 4) Crear columna temporal role_new si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND column_name='role_new'
  ) THEN
    ALTER TABLE users ADD COLUMN role_new user_role_new;
  END IF;

  -- 5) Migrar datos desde enum antiguo user_role
  UPDATE users SET role_new = 'ADMIN' WHERE role::text = 'ADMIN' AND role_new IS NULL;
  UPDATE users SET role_new = 'USER' WHERE role::text = 'USER' AND role_new IS NULL;

  -- Si hay usuarios con role NULL (data inconsistente), asumir USER
  UPDATE users SET role_new = 'USER' WHERE role IS NULL AND role_new IS NULL;

  UPDATE users SET role_new = 'AREA_USER', area = 'COMERCIAL'
    WHERE role::text = 'COMERCIAL' AND role_new IS NULL;
  UPDATE users SET role_new = 'AREA_USER', area = 'TECNICA'
    WHERE role::text = 'TECNICA' AND role_new IS NULL;
  UPDATE users SET role_new = 'AREA_USER', area = 'FINANCIERA'
    WHERE role::text = 'FINANCIERA' AND role_new IS NULL;
  UPDATE users SET role_new = 'AREA_USER', area = 'LEGAL'
    WHERE role::text = 'LEGAL' AND role_new IS NULL;

  -- Cualquier caso restante, asumir USER
  UPDATE users SET role_new = 'USER' WHERE role_new IS NULL;

  -- 6) Cambiar tipo de users.role a user_role_new usando role_new
  ALTER TABLE users ALTER COLUMN role DROP DEFAULT;
  ALTER TABLE users
    ALTER COLUMN role TYPE user_role_new
    USING role_new;

  -- 7) Eliminar columna temporal
  ALTER TABLE users DROP COLUMN role_new;

END$$;

-- 8) Ajustar workflow_steps.required_area si aún no existe (puede venir de migración previa)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='workflow_steps' AND column_name='required_area'
  ) THEN
    ALTER TABLE workflow_steps ADD COLUMN required_area user_area;
  END IF;
END$$;

