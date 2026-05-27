CREATE OR REPLACE FUNCTION generate_case_number()
RETURNS TRIGGER AS $fn$
DECLARE
    year_prefix VARCHAR(4);
    next_number INTEGER;
BEGIN
    year_prefix := TO_CHAR(CURRENT_TIMESTAMP, 'YYYY');
    SELECT COALESCE(MAX(CAST(SUBSTRING(numero_tramite FROM 6) AS INTEGER)), 0) + 1
    INTO next_number
    FROM tramites
    WHERE numero_tramite LIKE year_prefix || '%';
    NEW.numero_tramite := year_prefix || '-' || LPAD(next_number::TEXT, 6, '0');
    RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS generate_case_number_trigger ON tramites;
DROP TRIGGER IF EXISTS generate_case_number_trigger ON cases;

CREATE TRIGGER generate_case_number_trigger
    BEFORE INSERT ON tramites
    FOR EACH ROW
    WHEN (NEW.numero_tramite IS NULL)
    EXECUTE FUNCTION generate_case_number();
