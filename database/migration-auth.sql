-- ============================================
-- MIGRACIÓN: Autenticación y Roles
-- ============================================

-- 1. Agregar índice en role para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, is_active) WHERE is_active = true;

-- 2. Agregar campo para refresh tokens (opcional, para logout)
ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token_expires_at TIMESTAMP WITH TIME ZONE;

-- 3. Agregar campo para tracking de sesiones
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip INET;

-- 4. Tabla de sesiones activas (para control de sesiones múltiples)
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

-- 5. Función para limpiar sesiones expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM user_sessions WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- 6. Agregar campo para tracking de área actual en casos
ALTER TABLE cases ADD COLUMN IF NOT EXISTS current_area_role user_role;

-- Actualizar casos existentes con el área actual basado en el workflow
UPDATE cases c
SET current_area_role = ws.required_role
FROM case_workflows cw
JOIN workflow_steps ws ON ws.workflow_template_id = cw.workflow_template_id 
    AND ws.step_order = cw.current_step_order
WHERE c.id = cw.case_id
  AND c.current_area_role IS NULL;

-- 7. Índice para búsquedas por área
CREATE INDEX IF NOT EXISTS idx_cases_current_area ON cases(current_area_role, status) 
WHERE status IN ('SUBMITTED', 'IN_REVIEW');

-- 8. Vista para casos por área
CREATE OR REPLACE VIEW cases_by_area AS
SELECT 
    c.*,
    u.first_name || ' ' || u.last_name as creator_name,
    u.email as creator_email,
    ws.step_name as current_step_name,
    ws.required_role as current_required_role,
    (SELECT COUNT(*) FROM files WHERE case_id = c.id AND is_deleted = false) as file_count,
    (SELECT COUNT(*) FROM comments WHERE case_id = c.id) as comment_count
FROM cases c
JOIN users u ON c.created_by = u.id
LEFT JOIN case_workflows cw ON cw.case_id = c.id
LEFT JOIN workflow_steps ws ON ws.workflow_template_id = cw.workflow_template_id 
    AND ws.step_order = cw.current_step_order
WHERE c.status IN ('SUBMITTED', 'IN_REVIEW', 'RETURNED');

-- 9. Función para obtener casos según rol
CREATE OR REPLACE FUNCTION get_cases_for_user(
    p_user_id UUID,
    p_user_role user_role
)
RETURNS TABLE (
    id UUID,
    case_number VARCHAR,
    title VARCHAR,
    description TEXT,
    status case_status,
    created_by UUID,
    current_area_role user_role,
    priority INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    creator_name TEXT,
    file_count BIGINT,
    comment_count BIGINT
) AS $$
BEGIN
    IF p_user_role = 'ADMIN' THEN
        -- Admin ve todo
        RETURN QUERY
        SELECT 
            c.id, c.case_number, c.title, c.description, c.status,
            c.created_by, c.current_area_role, c.priority, c.created_at,
            u.first_name || ' ' || u.last_name as creator_name,
            (SELECT COUNT(*) FROM files WHERE case_id = c.id AND is_deleted = false)::BIGINT,
            (SELECT COUNT(*) FROM comments WHERE case_id = c.id)::BIGINT
        FROM cases c
        JOIN users u ON c.created_by = u.id
        ORDER BY c.created_at DESC;
        
    ELSIF p_user_role = 'USER' THEN
        -- Usuario normal solo ve sus casos
        RETURN QUERY
        SELECT 
            c.id, c.case_number, c.title, c.description, c.status,
            c.created_by, c.current_area_role, c.priority, c.created_at,
            u.first_name || ' ' || u.last_name as creator_name,
            (SELECT COUNT(*) FROM files WHERE case_id = c.id AND is_deleted = false)::BIGINT,
            (SELECT COUNT(*) FROM comments WHERE case_id = c.id)::BIGINT
        FROM cases c
        JOIN users u ON c.created_by = u.id
        WHERE c.created_by = p_user_id
        ORDER BY c.created_at DESC;
        
    ELSE
        -- Áreas ven casos en su paso actual
        RETURN QUERY
        SELECT 
            c.id, c.case_number, c.title, c.description, c.status,
            c.created_by, c.current_area_role, c.priority, c.created_at,
            u.first_name || ' ' || u.last_name as creator_name,
            (SELECT COUNT(*) FROM files WHERE case_id = c.id AND is_deleted = false)::BIGINT,
            (SELECT COUNT(*) FROM comments WHERE case_id = c.id)::BIGINT
        FROM cases c
        JOIN users u ON c.created_by = u.id
        WHERE c.current_area_role = p_user_role
          AND c.status IN ('SUBMITTED', 'IN_REVIEW')
        ORDER BY c.created_at DESC;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 10. Comentarios en nuevas estructuras
COMMENT ON TABLE user_sessions IS 'Sesiones activas de usuarios para control de acceso';
COMMENT ON COLUMN cases.current_area_role IS 'Área que actualmente debe revisar el caso';
COMMENT ON FUNCTION get_cases_for_user IS 'Obtiene casos filtrados según el rol del usuario';

-- 11. Trigger para actualizar current_area_role cuando cambia el workflow
CREATE OR REPLACE FUNCTION update_case_current_area()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE cases c
    SET current_area_role = ws.required_role
    FROM workflow_steps ws
    WHERE c.id = NEW.case_id
      AND ws.workflow_template_id = NEW.workflow_template_id
      AND ws.step_order = NEW.current_step_order;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_case_area
    AFTER UPDATE OF current_step_order ON case_workflows
    FOR EACH ROW
    EXECUTE FUNCTION update_case_current_area();
