-- ============================================
-- MIGRACIÓN: Separar Roles y Áreas
-- ============================================
-- Este script separa el concepto de "rol" (permisos) y "área" (departamento)

-- 1. Crear nuevo ENUM para roles simplificados
CREATE TYPE user_role_new AS ENUM (
    'USER',        -- Usuario normal (crea casos)
    'AREA_USER',   -- Usuario de área (revisa casos)
    'ADMIN'        -- Administrador
);

-- 2. Crear nuevo ENUM para áreas
CREATE TYPE user_area AS ENUM (
    'COMERCIAL',
    'TECNICA',
    'FINANCIERA',
    'LEGAL'
);

-- 3. Agregar columna temporal para el nuevo rol
ALTER TABLE users ADD COLUMN role_new user_role_new;

-- 4. Agregar columna para área
ALTER TABLE users ADD COLUMN area user_area;

-- 5. Migrar datos existentes de usuarios
UPDATE users SET role_new = 'ADMIN' WHERE role = 'ADMIN';
UPDATE users SET role_new = 'USER' WHERE role = 'USER';
UPDATE users SET role_new = 'AREA_USER', area = 'COMERCIAL' WHERE role = 'COMERCIAL';
UPDATE users SET role_new = 'AREA_USER', area = 'TECNICA' WHERE role = 'TECNICA';
UPDATE users SET role_new = 'AREA_USER', area = 'FINANCIERA' WHERE role = 'FINANCIERA';
UPDATE users SET role_new = 'AREA_USER', area = 'LEGAL' WHERE role = 'LEGAL';

-- 6. Agregar columna temporal para área en workflow_steps
ALTER TABLE workflow_steps ADD COLUMN required_area user_area;

-- Migrar datos de workflow_steps
UPDATE workflow_steps SET required_area = 'COMERCIAL' WHERE required_role = 'COMERCIAL';
UPDATE workflow_steps SET required_area = 'TECNICA' WHERE required_role = 'TECNICA';
UPDATE workflow_steps SET required_area = 'FINANCIERA' WHERE required_role = 'FINANCIERA';
UPDATE workflow_steps SET required_area = 'LEGAL' WHERE required_role = 'LEGAL';

-- 7. Agregar columna temporal para área en cases
ALTER TABLE cases ADD COLUMN current_area user_area;

-- Migrar datos de cases
UPDATE cases SET current_area = 'COMERCIAL' WHERE current_area_role = 'COMERCIAL';
UPDATE cases SET current_area = 'TECNICA' WHERE current_area_role = 'TECNICA';
UPDATE cases SET current_area = 'FINANCIERA' WHERE current_area_role = 'FINANCIERA';
UPDATE cases SET current_area = 'LEGAL' WHERE current_area_role = 'LEGAL';

-- 8. Eliminar vistas que dependen de las columnas antiguas
DROP VIEW IF EXISTS cases_with_creator CASCADE;
DROP VIEW IF EXISTS workflow_progress_view CASCADE;
DROP VIEW IF EXISTS cases_by_area CASCADE;

-- 9. Eliminar función que depende del tipo antiguo
DROP FUNCTION IF EXISTS get_cases_for_user(UUID, user_role, BOOLEAN);
DROP FUNCTION IF EXISTS get_cases_for_user(UUID, user_role);

-- 10. Eliminar columnas antiguas
ALTER TABLE users DROP COLUMN role;
ALTER TABLE workflow_steps DROP COLUMN required_role;
ALTER TABLE cases DROP COLUMN current_area_role;
ALTER TABLE cases DROP COLUMN IF EXISTS current_step_id;
ALTER TABLE cases DROP COLUMN IF EXISTS priority;

-- 11. Renombrar columnas nuevas
ALTER TABLE users RENAME COLUMN role_new TO role;

-- 12. Hacer role NOT NULL
ALTER TABLE users ALTER COLUMN role SET NOT NULL;

-- 13. Hacer required_area NOT NULL
ALTER TABLE workflow_steps ALTER COLUMN required_area SET NOT NULL;

-- 14. Eliminar el ENUM antiguo
DROP TYPE user_role;

-- 15. Renombrar el nuevo ENUM
ALTER TYPE user_role_new RENAME TO user_role;

-- 16. Recrear vista cases_with_creator
CREATE VIEW cases_with_creator AS
SELECT 
    c.*,
    u.first_name || ' ' || u.last_name as creator_name,
    u.email as creator_email,
    (SELECT COUNT(*) FROM files WHERE case_id = c.id AND is_deleted = false) as file_count,
    (SELECT COUNT(*) FROM comments WHERE case_id = c.id) as comment_count
FROM cases c
JOIN users u ON c.created_by = u.id;

-- 17. Recrear vista workflow_progress_view
CREATE VIEW workflow_progress_view AS
SELECT 
    cw.case_id,
    cw.workflow_template_id,
    wt.name as workflow_name,
    ws.step_order,
    ws.step_name,
    ws.required_area,
    wsp.status as step_status,
    wsp.assigned_to,
    wsp.reviewed_by,
    u1.first_name || ' ' || u1.last_name as assigned_to_name,
    u2.first_name || ' ' || u2.last_name as reviewed_by_name,
    wsp.comments,
    wsp.completed_at
FROM case_workflows cw
JOIN workflow_templates wt ON cw.workflow_template_id = wt.id
JOIN workflow_steps ws ON ws.workflow_template_id = wt.id
LEFT JOIN workflow_step_progress wsp ON wsp.case_workflow_id = cw.id AND wsp.workflow_step_id = ws.id
LEFT JOIN users u1 ON wsp.assigned_to = u1.id
LEFT JOIN users u2 ON wsp.reviewed_by = u2.id
ORDER BY cw.case_id, ws.step_order;

-- 18. Crear nueva función get_cases_for_user
CREATE OR REPLACE FUNCTION get_cases_for_user(
    p_user_id UUID,
    p_user_role user_role,
    p_user_area user_area,
    p_assigned_only BOOLEAN DEFAULT false
)
RETURNS TABLE (
    id UUID,
    case_number VARCHAR,
    title VARCHAR,
    description TEXT,
    status case_status,
    created_by UUID,
    current_area user_area,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    creator_name TEXT,
    creator_email VARCHAR,
    file_count BIGINT,
    comment_count BIGINT,
    advisor_name VARCHAR,
    document_file_name VARCHAR,
    odoo_code VARCHAR,
    client_provider VARCHAR,
    document_type document_type,
    sharepoint_url TEXT,
    request_date TIMESTAMP WITH TIME ZONE,
    required_delivery_date TIMESTAMP WITH TIME ZONE,
    urgency_justification TEXT,
    signature_type signature_type,
    template_type template_type,
    observations TEXT
) AS $$
BEGIN
    IF p_user_role = 'ADMIN' THEN
        -- Admin ve todo
        RETURN QUERY
        SELECT 
            c.id, c.case_number, c.title, c.description, c.status,
            c.created_by, c.current_area, c.created_at, c.updated_at, c.completed_at, c.due_date,
            u.first_name || ' ' || u.last_name as creator_name,
            u.email as creator_email,
            (SELECT COUNT(*) FROM files WHERE case_id = c.id AND is_deleted = false)::BIGINT,
            (SELECT COUNT(*) FROM comments WHERE case_id = c.id)::BIGINT,
            c.advisor_name, c.document_file_name, c.odoo_code, c.client_provider,
            c.document_type, c.sharepoint_url, c.request_date, c.required_delivery_date,
            c.urgency_justification, c.signature_type, c.template_type, c.observations
        FROM cases c
        JOIN users u ON c.created_by = u.id
        ORDER BY c.created_at DESC;
        
    ELSIF p_user_role = 'USER' THEN
        -- Usuario normal solo ve sus casos
        RETURN QUERY
        SELECT 
            c.id, c.case_number, c.title, c.description, c.status,
            c.created_by, c.current_area, c.created_at, c.updated_at, c.completed_at, c.due_date,
            u.first_name || ' ' || u.last_name as creator_name,
            u.email as creator_email,
            (SELECT COUNT(*) FROM files WHERE case_id = c.id AND is_deleted = false)::BIGINT,
            (SELECT COUNT(*) FROM comments WHERE case_id = c.id)::BIGINT,
            c.advisor_name, c.document_file_name, c.odoo_code, c.client_provider,
            c.document_type, c.sharepoint_url, c.request_date, c.required_delivery_date,
            c.urgency_justification, c.signature_type, c.template_type, c.observations
        FROM cases c
        JOIN users u ON c.created_by = u.id
        WHERE c.created_by = p_user_id
        ORDER BY c.created_at DESC;
        
    ELSE
        -- Usuarios de área (AREA_USER)
        IF p_assigned_only THEN
            -- Dashboard: Solo casos asignados al área
            RETURN QUERY
            SELECT 
                c.id, c.case_number, c.title, c.description, c.status,
                c.created_by, c.current_area, c.created_at, c.updated_at, c.completed_at, c.due_date,
                u.first_name || ' ' || u.last_name as creator_name,
                u.email as creator_email,
                (SELECT COUNT(*) FROM files WHERE case_id = c.id AND is_deleted = false)::BIGINT,
                (SELECT COUNT(*) FROM comments WHERE case_id = c.id)::BIGINT,
                c.advisor_name, c.document_file_name, c.odoo_code, c.client_provider,
                c.document_type, c.sharepoint_url, c.request_date, c.required_delivery_date,
                c.urgency_justification, c.signature_type, c.template_type, c.observations
            FROM cases c
            JOIN users u ON c.created_by = u.id
            WHERE c.current_area = p_user_area
            ORDER BY c.created_at DESC;
        ELSE
            -- Página "Casos": Todos los casos
            RETURN QUERY
            SELECT 
                c.id, c.case_number, c.title, c.description, c.status,
                c.created_by, c.current_area, c.created_at, c.updated_at, c.completed_at, c.due_date,
                u.first_name || ' ' || u.last_name as creator_name,
                u.email as creator_email,
                (SELECT COUNT(*) FROM files WHERE case_id = c.id AND is_deleted = false)::BIGINT,
                (SELECT COUNT(*) FROM comments WHERE case_id = c.id)::BIGINT,
                c.advisor_name, c.document_file_name, c.odoo_code, c.client_provider,
                c.document_type, c.sharepoint_url, c.request_date, c.required_delivery_date,
                c.urgency_justification, c.signature_type, c.template_type, c.observations
            FROM cases c
            JOIN users u ON c.created_by = u.id
            ORDER BY c.created_at DESC;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 19. Comentarios
COMMENT ON COLUMN users.role IS 'Rol del usuario: USER (crea casos), AREA_USER (revisa casos), ADMIN (administrador)';
COMMENT ON COLUMN users.area IS 'Área del usuario (solo para AREA_USER): COMERCIAL, TECNICA, FINANCIERA, LEGAL';
COMMENT ON COLUMN cases.current_area IS 'Área actual donde está el caso para revisión';
COMMENT ON COLUMN workflow_steps.required_area IS 'Área requerida para aprobar este paso';

-- ============================================
-- FIN DE MIGRACIÓN
-- ============================================
