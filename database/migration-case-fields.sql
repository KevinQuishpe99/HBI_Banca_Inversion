-- Migración: Agregar campos del formulario de revisión legal
-- Fecha: 2026-03-29

-- Agregar nuevos tipos ENUM (solo si no existen)
DO $$ BEGIN
    CREATE TYPE document_type AS ENUM (
        'CONTRATO',
        'CONVENIO',
        'ACUERDO',
        'OTRO'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE signature_type AS ENUM (
        'FISICA',
        'ELECTRONICA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE template_type AS ENUM (
        'PLANTILLA_COMWARE',
        'PLANTILLA_CLIENTE',
        'PLANTILLA_PROVEEDOR'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Agregar nuevas columnas a la tabla cases
ALTER TABLE cases ADD COLUMN IF NOT EXISTS advisor_name VARCHAR(255);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS document_file_name VARCHAR(255);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS odoo_code VARCHAR(6);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS client_provider VARCHAR(255);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS document_type document_type;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS sharepoint_url TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS request_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS required_delivery_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS urgency_justification TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS signature_type signature_type;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS template_type template_type;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS observations TEXT;

-- Agregar constraint para código Odoo (debe empezar con S) - solo si no existe
DO $$ BEGIN
    ALTER TABLE cases ADD CONSTRAINT check_odoo_code_format 
        CHECK (odoo_code IS NULL OR odoo_code ~ '^S');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Agregar comentarios a las nuevas columnas
COMMENT ON COLUMN cases.advisor_name IS 'Asesor comercial o responsable de la solicitud';
COMMENT ON COLUMN cases.document_file_name IS 'Nombre completo del archivo con extensión';
COMMENT ON COLUMN cases.odoo_code IS 'Código Odoo (máximo 6 caracteres, empieza con S)';
COMMENT ON COLUMN cases.client_provider IS 'Nombre del cliente o proveedor';
COMMENT ON COLUMN cases.document_type IS 'Tipo de documento (contrato, convenio, acuerdo, otro)';
COMMENT ON COLUMN cases.sharepoint_url IS 'URL del documento en SharePoint';
COMMENT ON COLUMN cases.request_date IS 'Fecha de la solicitud';
COMMENT ON COLUMN cases.required_delivery_date IS 'Fecha de entrega requerida';
COMMENT ON COLUMN cases.urgency_justification IS 'Justificación si es urgente';
COMMENT ON COLUMN cases.signature_type IS 'Tipo de firma (física o electrónica)';
COMMENT ON COLUMN cases.template_type IS 'Tipo de plantilla utilizada';
COMMENT ON COLUMN cases.observations IS 'Observaciones adicionales';
