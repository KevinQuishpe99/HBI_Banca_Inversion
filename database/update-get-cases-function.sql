-- Actualizar función get_cases_for_user para incluir todos los campos nuevos
DROP FUNCTION IF EXISTS get_cases_for_user(UUID, user_role);
DROP FUNCTION IF EXISTS get_cases_for_user(UUID, user_role, BOOLEAN);

CREATE OR REPLACE FUNCTION get_cases_for_user(
    p_user_id UUID,
    p_user_role user_role,
    p_assigned_only BOOLEAN DEFAULT false
)
RETURNS TABLE (
    id UUID,
    case_number VARCHAR,
    title VARCHAR,
    description TEXT,
    status case_status,
    created_by UUID,
    current_area_role user_role,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    creator_name TEXT,
    creator_email VARCHAR,
    file_count BIGINT,
    comment_count BIGINT,
    -- Nuevos campos del formulario
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
            c.created_by, c.current_area_role, c.created_at, c.updated_at, c.completed_at, c.due_date,
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
            c.created_by, c.current_area_role, c.created_at, c.updated_at, c.completed_at, c.due_date,
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
        -- Áreas (COMERCIAL, TECNICA, FINANCIERA, LEGAL)
        IF p_assigned_only THEN
            -- Dashboard: Solo casos asignados al área
            RETURN QUERY
            SELECT 
                c.id, c.case_number, c.title, c.description, c.status,
                c.created_by, c.current_area_role, c.created_at, c.updated_at, c.completed_at, c.due_date,
                u.first_name || ' ' || u.last_name as creator_name,
                u.email as creator_email,
                (SELECT COUNT(*) FROM files WHERE case_id = c.id AND is_deleted = false)::BIGINT,
                (SELECT COUNT(*) FROM comments WHERE case_id = c.id)::BIGINT,
                c.advisor_name, c.document_file_name, c.odoo_code, c.client_provider,
                c.document_type, c.sharepoint_url, c.request_date, c.required_delivery_date,
                c.urgency_justification, c.signature_type, c.template_type, c.observations
            FROM cases c
            JOIN users u ON c.created_by = u.id
            WHERE c.current_area_role = p_user_role
            ORDER BY c.created_at DESC;
        ELSE
            -- Página "Casos": Todos los casos
            RETURN QUERY
            SELECT 
                c.id, c.case_number, c.title, c.description, c.status,
                c.created_by, c.current_area_role, c.created_at, c.updated_at, c.completed_at, c.due_date,
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
