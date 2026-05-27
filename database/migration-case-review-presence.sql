-- Presencia: usuarios de área con la pestaña de revisión abierta (heartbeat).
-- Permite mostrar "revisión en curso" y bloquear quitar áreas mientras alguien revisa.

CREATE TABLE IF NOT EXISTS case_review_presence (
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_area user_area NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (case_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_case_review_presence_case_seen
  ON case_review_presence (case_id, last_seen_at);

COMMENT ON TABLE case_review_presence IS 'Heartbeat de revisores en el detalle del trámite (no sustituye workflow_step_progress).';
