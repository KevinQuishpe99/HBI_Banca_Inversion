-- Enrutado: Flujo 1 (supervisión + revisiones + Legal) vs Flujo 2 (directo a Legal).
-- Tabla routing_creator_area: qué área de creador usa qué flujo y área de supervisión (Flujo 1).

CREATE TABLE IF NOT EXISTS routing_creator_area (
  creator_area user_area PRIMARY KEY,
  flow_kind TEXT NOT NULL CHECK (flow_kind IN ('SUPERVISION_CHAIN', 'DIRECT_LEGAL')),
  supervision_area user_area NULL,
  CONSTRAINT routing_supervision_ck CHECK (
    (flow_kind = 'DIRECT_LEGAL' AND supervision_area IS NULL)
    OR (flow_kind = 'SUPERVISION_CHAIN' AND supervision_area IS NOT NULL)
  )
);

COMMENT ON TABLE routing_creator_area IS 'Origen (área del creador) → flujo; SUPERVISION_CHAIN requiere supervision_area.';

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS creator_area user_area NULL,
  ADD COLUMN IF NOT EXISTS routing_flow TEXT NULL CHECK (routing_flow IS NULL OR routing_flow IN ('SUPERVISION_CHAIN', 'DIRECT_LEGAL')),
  ADD COLUMN IF NOT EXISTS supervision_area user_area NULL,
  ADD COLUMN IF NOT EXISTS supervision_completed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN cases.creator_area IS 'Área del usuario creador al crear el trámite (snapshot).';
COMMENT ON COLUMN cases.routing_flow IS 'SUPERVISION_CHAIN | DIRECT_LEGAL; NULL = legacy.';
COMMENT ON COLUMN cases.supervision_area IS 'Área que asigna review_areas en Flujo 1 (copia de config).';
COMMENT ON COLUMN cases.supervision_completed IS 'Flujo 1: true cuando supervisión ya definió review_areas y se envió a revisión.';

-- Vista: recrear para exponer nuevas columnas
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

-- Ampliar get_cases_for_user con columnas de enrutado (para listados y filtros en app).

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
    approved_review_areas user_area[],
    return_allow_file_update BOOLEAN,
    last_return_reason TEXT,
    last_return_area TEXT,
    return_history JSONB,
    creator_area user_area,
    routing_flow TEXT,
    supervision_area user_area,
    supervision_completed BOOLEAN
) AS $$
BEGIN
    IF p_user_role = 'ADMIN' THEN
        RETURN QUERY
        SELECT
            c.id, c.case_number, c.title, c.description, c.status,
            c.created_by, c.current_area, c.created_at, c.updated_at, c.completed_at, c.due_date,
            u.first_name || ' ' || u.last_name AS creator_name,
            u.email AS creator_email,
            (SELECT COUNT(*) FROM files WHERE case_id = c.id AND is_deleted = false)::BIGINT,
            (SELECT COUNT(*) FROM comments WHERE case_id = c.id)::BIGINT,
            c.advisor_name, c.document_file_name, c.odoo_code, c.client_provider,
            c.document_type, c.sharepoint_url, c.request_date, c.required_delivery_date,
            c.urgency_justification, c.signature_type, c.template_type, c.observations,
            c.review_areas,
            COALESCE(c.approved_review_areas, '{}'::user_area[]),
            COALESCE(c.return_allow_file_update, false),
            c.last_return_reason, c.last_return_area,
            c.return_history,
            c.creator_area, c.routing_flow, c.supervision_area, c.supervision_completed
        FROM cases c
        JOIN users u ON c.created_by = u.id
        ORDER BY c.created_at DESC;

    ELSIF p_user_role = 'USER' THEN
        RETURN QUERY
        SELECT
            c.id, c.case_number, c.title, c.description, c.status,
            c.created_by, c.current_area, c.created_at, c.updated_at, c.completed_at, c.due_date,
            u.first_name || ' ' || u.last_name AS creator_name,
            u.email AS creator_email,
            (SELECT COUNT(*) FROM files WHERE case_id = c.id AND is_deleted = false)::BIGINT,
            (SELECT COUNT(*) FROM comments WHERE case_id = c.id)::BIGINT,
            c.advisor_name, c.document_file_name, c.odoo_code, c.client_provider,
            c.document_type, c.sharepoint_url, c.request_date, c.required_delivery_date,
            c.urgency_justification, c.signature_type, c.template_type, c.observations,
            c.review_areas,
            COALESCE(c.approved_review_areas, '{}'::user_area[]),
            COALESCE(c.return_allow_file_update, false),
            c.last_return_reason, c.last_return_area,
            c.return_history,
            c.creator_area, c.routing_flow, c.supervision_area, c.supervision_completed
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
                u.first_name || ' ' || u.last_name AS creator_name,
                u.email AS creator_email,
                (SELECT COUNT(*) FROM files WHERE case_id = c.id AND is_deleted = false)::BIGINT,
                (SELECT COUNT(*) FROM comments WHERE case_id = c.id)::BIGINT,
                c.advisor_name, c.document_file_name, c.odoo_code, c.client_provider,
                c.document_type, c.sharepoint_url, c.request_date, c.required_delivery_date,
                c.urgency_justification, c.signature_type, c.template_type, c.observations,
                c.review_areas,
                COALESCE(c.approved_review_areas, '{}'::user_area[]),
                COALESCE(c.return_allow_file_update, false),
                c.last_return_reason, c.last_return_area,
                c.return_history,
                c.creator_area, c.routing_flow, c.supervision_area, c.supervision_completed
            FROM cases c
            JOIN users u ON c.created_by = u.id
            WHERE c.status = 'IN_REVIEW'::case_status
              AND (
                (
                  NOT (p_user_area = ANY (COALESCE(c.approved_review_areas, '{}'::user_area[])))
                  AND (
                    p_user_area = ANY (COALESCE(c.review_areas, '{}'::user_area[]))
                    OR EXISTS (
                      SELECT 1 FROM area_config ac
                      WHERE ac.area = p_user_area
                        AND ac.is_mandatory = true
                        AND ac.is_active = true
                    )
                  )
                )
                OR (
                  p_user_area = 'DIRECTOR_GENERAL'::user_area
                  AND c.status IN ('SUBMITTED'::case_status, 'IN_REVIEW'::case_status)
                )
              )
            ORDER BY c.created_at DESC;
        ELSE
            RETURN QUERY
            SELECT
                c.id, c.case_number, c.title, c.description, c.status,
                c.created_by, c.current_area, c.created_at, c.updated_at, c.completed_at, c.due_date,
                u.first_name || ' ' || u.last_name AS creator_name,
                u.email AS creator_email,
                (SELECT COUNT(*) FROM files WHERE case_id = c.id AND is_deleted = false)::BIGINT,
                (SELECT COUNT(*) FROM comments WHERE case_id = c.id)::BIGINT,
                c.advisor_name, c.document_file_name, c.odoo_code, c.client_provider,
                c.document_type, c.sharepoint_url, c.request_date, c.required_delivery_date,
                c.urgency_justification, c.signature_type, c.template_type, c.observations,
                c.review_areas,
                COALESCE(c.approved_review_areas, '{}'::user_area[]),
                COALESCE(c.return_allow_file_update, false),
                c.last_return_reason, c.last_return_area,
                c.return_history,
                c.creator_area, c.routing_flow, c.supervision_area, c.supervision_completed
            FROM cases c
            JOIN users u ON c.created_by = u.id
            ORDER BY c.created_at DESC;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;
