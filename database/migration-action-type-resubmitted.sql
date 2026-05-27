-- Añade acción de auditoría para reenvío tras devolución (historial del trámite).
ALTER TYPE action_type ADD VALUE IF NOT EXISTS 'RESUBMITTED';
