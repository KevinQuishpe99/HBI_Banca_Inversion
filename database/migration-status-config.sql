-- Catálogo de etiquetas y colores para estados de trámite y de pasos de workflow (editable por admin).
-- Los códigos deben coincidir con los ENUM de PostgreSQL (estado_tramite, workflow_step_status).

CREATE TABLE IF NOT EXISTS case_status_config (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  variant TEXT NOT NULL DEFAULT 'gray',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT case_status_config_variant_check CHECK (
    variant IN ('gray','blue','yellow','green','red','orange','indigo','purple','emerald','slate')
  )
);

CREATE TABLE IF NOT EXISTS workflow_step_status_config (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  variant TEXT NOT NULL DEFAULT 'gray',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT workflow_step_status_config_variant_check CHECK (
    variant IN ('gray','blue','yellow','green','red','orange','indigo','purple','emerald','slate')
  )
);

INSERT INTO case_status_config (code, label, variant, sort_order) VALUES
  ('TRAMITE_ENVIADO', 'Trámite enviado', 'blue', 20),
  ('EN_REVISION', 'En revisión', 'yellow', 30),
  ('REVISADO', 'Revisado', 'green', 40),
  ('DEVUELTO', 'Devuelto', 'orange', 50),
  ('TRAMITE_COMPLETADO', 'Trámite completado', 'emerald', 60)
ON CONFLICT (code) DO UPDATE
SET label = EXCLUDED.label,
    variant = EXCLUDED.variant,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

-- No listar REVISADO en meta ni badges configurables; el flujo puede aún escribir el ENUM en casos raros.
UPDATE case_status_config
SET is_active = false, updated_at = CURRENT_TIMESTAMP
WHERE code = 'REVISADO';

INSERT INTO workflow_step_status_config (code, label, variant, sort_order) VALUES
  ('PENDING', 'Pendiente', 'gray', 10),
  ('IN_PROGRESS', 'En progreso', 'blue', 20),
  ('APPROVED', 'Aprobado', 'green', 30),
  ('REJECTED', 'Devuelto', 'orange', 40),
  ('SKIPPED', 'Omitido', 'slate', 50)
ON CONFLICT (code) DO UPDATE
SET label = EXCLUDED.label,
    variant = EXCLUDED.variant,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;
