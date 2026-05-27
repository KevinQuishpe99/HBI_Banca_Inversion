-- Devolución: permitir al solicitante reemplazar/borrar archivos (no iniciales) y auditoría
ALTER TABLE cases ADD COLUMN IF NOT EXISTS return_allow_file_update BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS last_return_reason TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS last_return_area TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS return_history JSONB DEFAULT '[]'::jsonb;

-- Comentarios por archivo (área que comenta durante revisión)
CREATE TABLE IF NOT EXISTS file_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  user_area TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_file_comments_case ON file_comments(case_id);
CREATE INDEX IF NOT EXISTS idx_file_comments_file ON file_comments(file_id);

-- Incluir nuevas columnas de cases en la vista (c.* se resuelve al crear la vista)
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
