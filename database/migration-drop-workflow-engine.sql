-- Elimina enrutado Comercial/Legal (si existía) y el motor de workflow (plantillas, pasos, progreso).
-- Sustituye por columna cases.approved_review_areas (áreas que ya aprobaron).
-- Requiere BD con columna cases.status tipo case_status (como migration-dg-visibility).
-- Tras aplicar: ejecutar npm run build y probar revisión / aprobación.

-- Enrutado configurable (reglas Comercial vs Legal); idempotente si ya se aplicó antes.
DROP VIEW IF EXISTS cases_with_creator CASCADE;
DROP TABLE IF EXISTS workflow_routing_rules;
DROP TABLE IF EXISTS commercial_assignable_area;
ALTER TABLE cases DROP COLUMN IF EXISTS route_type;
ALTER TABLE cases DROP COLUMN IF EXISTS commercial_routing_done;
DROP TYPE IF EXISTS case_route_type CASCADE;

ALTER TABLE cases ADD COLUMN IF NOT EXISTS approved_review_areas user_area[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'case_workflows') THEN
    UPDATE cases c
    SET approved_review_areas = COALESCE(
      (
        SELECT array_agg(sub.required_area ORDER BY sub.step_order)
        FROM (
          SELECT ws.required_area, MIN(ws.step_order) AS step_order
          FROM case_workflows cw
          JOIN workflow_step_progress wsp ON wsp.case_workflow_id = cw.id
          JOIN workflow_steps ws ON ws.id = wsp.workflow_step_id
          WHERE cw.case_id = c.id
            AND wsp.status = 'APPROVED'::workflow_step_status
          GROUP BY ws.required_area
        ) sub
      ),
      '{}'::user_area[]
    );
  END IF;
END $$;

DROP VIEW IF EXISTS workflow_progress_view CASCADE;

DROP TABLE IF EXISTS workflow_step_progress CASCADE;
DROP TABLE IF EXISTS case_workflows CASCADE;
DROP TABLE IF EXISTS workflow_steps CASCADE;
DROP TABLE IF EXISTS workflow_templates CASCADE;
DROP TABLE IF EXISTS workflow_step_status_config CASCADE;

ALTER TABLE cases DROP COLUMN IF EXISTS current_step_id;

DROP TYPE IF EXISTS workflow_step_status CASCADE;

-- Vista cases_with_creator (c.* incluye approved_review_areas)
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
    return_history JSONB
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
            c.return_history
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
                c.return_history
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
                c.return_history
            FROM cases c
            JOIN users u ON c.created_by = u.id
            ORDER BY c.created_at DESC;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;
