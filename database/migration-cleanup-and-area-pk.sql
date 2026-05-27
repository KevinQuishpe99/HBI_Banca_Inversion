-- ============================================================
-- MIGRACIÓN: Limpieza de DB + PK numérica en area_config
-- ============================================================
-- Ejecutar después de todas las migraciones previas.
-- Elimina objetos sin uso y cambia la PK de area_config a id numérico.

BEGIN;

-- ── 1. Eliminar tabla user_sessions (nunca usada en la app) ─────────────
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_sessions();

-- ── 2. Eliminar columnas muertas de users ───────────────────────────────
ALTER TABLE users DROP COLUMN IF EXISTS refresh_token;
ALTER TABLE users DROP COLUMN IF EXISTS refresh_token_expires_at;
ALTER TABLE users DROP COLUMN IF EXISTS last_login_ip;

-- ── 3. Eliminar vista cases_by_area (depende de columnas/tablas legacy) ─
DROP VIEW IF EXISTS cases_by_area CASCADE;

-- ── 4. Eliminar trigger/función legacy (referencia case_workflows) ──────
DROP TRIGGER IF EXISTS trigger_update_case_area ON case_workflows;
DROP FUNCTION IF EXISTS update_case_current_area();

-- ── 5. area_config: agregar PK numérica ─────────────────────────────────
-- 5a. Agregar columna id si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'area_config' AND column_name = 'id'
  ) THEN
    ALTER TABLE area_config ADD COLUMN id SERIAL;
  END IF;
END $$;

-- 5b. Quitar PK actual (area)
ALTER TABLE area_config DROP CONSTRAINT IF EXISTS area_config_pkey;

-- 5c. Establecer id como PK
ALTER TABLE area_config ADD PRIMARY KEY (id);

-- 5d. area sigue siendo único (las demás tablas referencian el enum, no la FK)
ALTER TABLE area_config ADD CONSTRAINT area_config_area_unique UNIQUE (area);

-- ── 6. Actualizar índice de sesiones que ya no existe ────────────────────
DROP INDEX IF EXISTS idx_sessions_user;
DROP INDEX IF EXISTS idx_sessions_token;
DROP INDEX IF EXISTS idx_sessions_expires;

COMMIT;
