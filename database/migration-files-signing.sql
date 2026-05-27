-- ============================================
-- MIGRACIÓN: soporte para firma de director
-- ============================================

-- 1) Marcar archivos firmados y vincularlos al original
ALTER TABLE files
  ADD COLUMN IF NOT EXISTS is_signed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signed_source_file_id UUID REFERENCES files(id);

-- 2) Tabla para indicar qué archivos deben ser firmados por el director
CREATE TABLE IF NOT EXISTS files_to_sign (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  required_by_area user_area NOT NULL DEFAULT 'LEGAL',
  is_signed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (case_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_files_to_sign_case ON files_to_sign(case_id);
CREATE INDEX IF NOT EXISTS idx_files_to_sign_signed ON files_to_sign(case_id, is_signed);

