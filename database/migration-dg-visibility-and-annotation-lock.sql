-- Director General: en assignedOnly ver también trámites enviados o en revisión con workflow (no solo paso propio).
-- Bloqueo suave de anotaciones por archivo (otra área puede ver pero no anotar en paralelo).
--
-- Esquema: columnas `cases.status` tipo `case_status` (entornos migrados desde inglés).
-- Si tu BD usa `estado`/`estado_tramite`, ejecuta una variante manual o migra el esquema.

CREATE TABLE IF NOT EXISTS file_annotation_lock (
  file_id UUID NOT NULL PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_area user_area NOT NULL,
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_file_annotation_lock_heartbeat
  ON file_annotation_lock (last_heartbeat);

COMMENT ON TABLE file_annotation_lock IS 'Sesión de anotación en PDF: un usuario activo; heartbeat ~45s. Otras áreas pueden previsualizar sin bloqueo.';

DROP FUNCTION IF EXISTS get_cases_for_user(UUID, user_role_new, user_area, BOOLEAN);

CREATE OR REPLACE FUNCTION get_cases_for_user(
    p_user_id UUID,
    p_user_role user_role_new,
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
    observations TEXT,
    review_areas user_area[],
    return_allow_file_update BOOLEAN,
    last_return_reason TEXT,
    last_return_area TEXT,
    return_history JSONB
 ) AS $$
BEGIN
    IF p_user_role = 'ADMIN' THEN
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
            c.urgency_justification, c.signature_type, c.template_type, c.observations,
            c.review_areas,
            COALESCE(c.return_allow_file_update,false),
            c.last_return_reason, c.last_return_area,
            c.return_history
        FROM cases c
        JOIN users u ON c.created_by = u.id
        ORDER BY c.created_at DESC;
        
    ELSIF p_user_role = 'USER' THEN
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
            c.urgency_justification, c.signature_type, c.template_type, c.observations,
            c.review_areas,
            COALESCE(c.return_allow_file_update,false),
            c.last_return_reason, c.last_return_area,
            c.return_history
        FROM cases c
        JOIN users u ON c.created_by = u.id
        WHERE c.created_by = p_user_id
        ORDER BY c.created_at DESC;
        
    ELSE
        IF p_assigned_only THEN
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
                c.urgency_justification, c.signature_type, c.template_type, c.observations,
                c.review_areas,
                COALESCE(c.return_allow_file_update,false),
                c.last_return_reason, c.last_return_area,
                c.return_history
            FROM cases c
            JOIN users u ON c.created_by = u.id
            WHERE (
              EXISTS (
                SELECT 1
                FROM case_workflows cw
                JOIN workflow_step_progress wsp ON wsp.case_workflow_id = cw.id
                JOIN workflow_steps ws ON ws.id = wsp.workflow_step_id
                WHERE cw.case_id = c.id
                  AND wsp.status IN ('PENDING','IN_PROGRESS')
                  AND ws.required_area = p_user_area
              )
              OR (
                p_user_area = 'DIRECTOR_GENERAL'::user_area
                AND c.status IN ('SUBMITTED'::case_status, 'IN_REVIEW'::case_status)
                AND EXISTS (SELECT 1 FROM case_workflows cw2 WHERE cw2.case_id = c.id)
              )
            )
            ORDER BY c.created_at DESC;
        ELSE
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
                c.urgency_justification, c.signature_type, c.template_type, c.observations,
                c.review_areas,
                COALESCE(c.return_allow_file_update,false),
                c.last_return_reason, c.last_return_area,
                c.return_history
            FROM cases c
            JOIN users u ON c.created_by = u.id
            ORDER BY c.created_at DESC;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;
