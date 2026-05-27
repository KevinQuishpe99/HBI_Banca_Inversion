-- ============================================================
-- MIGRACIÓN: Eliminar columnas sin uso en toda la base
-- ============================================================
-- Columnas que nunca se leen/escriben desde el código de la app,
-- o que siempre contienen NULL.

BEGIN;

-- ── audit_log: ip_address y user_agent siempre NULL ─────────
ALTER TABLE audit_log DROP COLUMN IF EXISTS ip_address;
ALTER TABLE audit_log DROP COLUMN IF EXISTS user_agent;

-- ── comments: parent_comment_id nunca se usa (respuestas anidadas no implementadas) ──
DROP INDEX IF EXISTS idx_comments_parent;
ALTER TABLE comments DROP COLUMN IF EXISTS parent_comment_id;

-- ── notifications: action_url (solo en schema.sql histórico, nunca usada) ──
ALTER TABLE notifications DROP COLUMN IF EXISTS action_url;

-- ── Tablas de catálogo: created_at / updated_at nunca leídos ─
ALTER TABLE area_config DROP COLUMN IF EXISTS created_at;
ALTER TABLE area_config DROP COLUMN IF EXISTS updated_at;

ALTER TABLE case_status_config DROP COLUMN IF EXISTS created_at;
ALTER TABLE case_status_config DROP COLUMN IF EXISTS updated_at;

ALTER TABLE document_type_config DROP COLUMN IF EXISTS created_at;
ALTER TABLE document_type_config DROP COLUMN IF EXISTS updated_at;

ALTER TABLE signature_type_config DROP COLUMN IF EXISTS created_at;
ALTER TABLE signature_type_config DROP COLUMN IF EXISTS updated_at;

ALTER TABLE template_type_config DROP COLUMN IF EXISTS created_at;
ALTER TABLE template_type_config DROP COLUMN IF EXISTS updated_at;

COMMIT;
