-- Migración: Sistema de Notificaciones
-- Descripción: Agrega tabla de notificaciones para alertar a usuarios sobre cambios en casos

-- Crear tipo ENUM para tipos de notificación
CREATE TYPE notification_type AS ENUM (
  'CASE_SUBMITTED',      -- Caso enviado para revisión (para área)
  'CASE_APPROVED',       -- Caso aprobado por un área (para creador)
  'CASE_RETURNED',       -- Caso devuelto para correcciones (para creador)
  'CASE_REJECTED',       -- Caso rechazado (para creador)
  'CASE_RESUBMITTED',    -- Caso reenviado después de correcciones (para área)
  'CASE_COMPLETED',      -- Caso completado (para creador)
  'CASE_COMMENT'         -- Nuevo comentario en caso (para todos los involucrados)
);

-- Crear tabla de notificaciones
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Índices para mejorar rendimiento
  CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_notification_case FOREIGN KEY (case_id) REFERENCES cases(id)
);

-- Crear índices
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_case_id ON notifications(case_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- Función para obtener notificaciones de un usuario
CREATE OR REPLACE FUNCTION get_user_notifications(
  p_user_id UUID,
  p_unread_only BOOLEAN DEFAULT FALSE,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  case_id UUID,
  case_number VARCHAR,
  case_title VARCHAR,
  type notification_type,
  title VARCHAR,
  message TEXT,
  is_read BOOLEAN,
  read_at TIMESTAMP,
  created_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id,
    n.case_id,
    c.case_number,
    c.title as case_title,
    n.type,
    n.title,
    n.message,
    n.is_read,
    n.read_at,
    n.created_at
  FROM notifications n
  JOIN cases c ON n.case_id = c.id
  WHERE n.user_id = p_user_id
    AND (NOT p_unread_only OR n.is_read = FALSE)
  ORDER BY n.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Función para contar notificaciones no leídas
CREATE OR REPLACE FUNCTION count_unread_notifications(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  unread_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO unread_count
  FROM notifications
  WHERE user_id = p_user_id AND is_read = FALSE;
  
  RETURN unread_count;
END;
$$ LANGUAGE plpgsql;

-- Función para marcar notificación como leída
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE notifications
  SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
  WHERE id = p_notification_id AND is_read = FALSE;
END;
$$ LANGUAGE plpgsql;

-- Función para marcar todas las notificaciones de un usuario como leídas
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE notifications
  SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
  WHERE user_id = p_user_id AND is_read = FALSE;
END;
$$ LANGUAGE plpgsql;

-- Función para crear notificación
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_case_id UUID,
  p_type notification_type,
  p_title VARCHAR,
  p_message TEXT
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, case_id, type, title, message)
  VALUES (p_user_id, p_case_id, p_type, p_title, p_message)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- Comentarios
COMMENT ON TABLE notifications IS 'Notificaciones para usuarios sobre cambios en casos';
COMMENT ON COLUMN notifications.type IS 'Tipo de notificación';
COMMENT ON COLUMN notifications.is_read IS 'Indica si la notificación ha sido leída';
COMMENT ON COLUMN notifications.read_at IS 'Fecha y hora en que se leyó la notificación';

-- Mensaje de éxito
DO $$
BEGIN
  RAISE NOTICE '✅ Migración de notificaciones completada exitosamente';
END $$;
