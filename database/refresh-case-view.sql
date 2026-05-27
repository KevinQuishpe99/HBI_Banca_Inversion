-- Refrescar vista de casos con todos los campos nuevos
DROP VIEW IF EXISTS cases_with_creator CASCADE;

CREATE VIEW cases_with_creator AS
SELECT 
    c.*,
    u.first_name || ' ' || u.last_name as creator_name,
    u.email as creator_email,
    (SELECT COUNT(*) FROM files WHERE case_id = c.id AND is_deleted = false) as file_count,
    (SELECT COUNT(*) FROM comments WHERE case_id = c.id) as comment_count
FROM cases c
JOIN users u ON c.created_by = u.id;
