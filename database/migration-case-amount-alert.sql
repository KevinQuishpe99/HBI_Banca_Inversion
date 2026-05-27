-- Monto en trámites, umbral configurable y notificación CASE_HIGH_AMOUNT

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS amount_applies BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS amount_value NUMERIC(18, 2) NULL;

COMMENT ON COLUMN cases.amount_applies IS 'Si el trámite declara monto asociado.';
COMMENT ON COLUMN cases.amount_value IS 'Monto declarado (misma moneda que el umbral en administración).';

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_numeric NUMERIC(20, 2) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (key, value_numeric)
VALUES ('amount_alert_threshold', 100000)
ON CONFLICT (key) DO NOTHING;

DO $$
BEGIN
  ALTER TYPE notification_type ADD VALUE 'CASE_HIGH_AMOUNT';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DROP VIEW IF EXISTS cases_with_creator CASCADE;

CREATE VIEW cases_with_creator AS
SELECT
  c.*,
  u.first_name || ' ' || u.last_name AS creator_name,
  u.email AS creator_email,
  (SELECT COUNT(*) FROM files WHERE case_id = c.id AND is_deleted = false) AS file_count,
  (SELECT COUNT(*) FROM comments WHERE case_id = c.id) AS comment_count
FROM cases c
JOIN users u ON c.created_by = u.id;
