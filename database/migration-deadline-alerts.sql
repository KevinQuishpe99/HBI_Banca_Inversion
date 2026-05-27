-- Alertas por fecha límite: configuración en app_settings + tabla de dedup
-- Ejecutar tras migration-case-amount-alert.sql (app_settings ya existe).

-- ── Configuración global ──────────────────────────────────────────────────────
INSERT INTO app_settings (key, value_numeric)
VALUES
  ('deadline_reminder_days', 2),
  ('deadline_overdue_enabled', 1),
  ('deadline_overdue_repeat_days', 3)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE app_settings IS
  'Ajustes globales de la aplicación (clave/valor numérico). deadline_reminder_days = días antes de la fecha límite para recordatorio; deadline_overdue_enabled = 1/0; deadline_overdue_repeat_days = cada cuántos días repetir aviso post-vencimiento.';

-- ── Tabla de dedup: evita reenviar el mismo tipo de alerta varias veces ───────
CREATE TABLE IF NOT EXISTS case_deadline_alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  alert_tier  TEXT NOT NULL CHECK (alert_tier IN ('REMINDER','URGENT','OVERDUE')),
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (case_id, alert_tier)
);

CREATE INDEX IF NOT EXISTS idx_case_deadline_alerts_case
  ON case_deadline_alerts (case_id);

-- ── Nuevos tipos de notificación ──────────────────────────────────────────────
DO $$
BEGIN
  ALTER TYPE notification_type ADD VALUE 'CASE_DEADLINE_REMINDER';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE notification_type ADD VALUE 'CASE_DEADLINE_URGENT';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE notification_type ADD VALUE 'CASE_DEADLINE_OVERDUE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
