-- Habilita configuración de permiso de firma por usuario
ALTER TABLE users
ADD COLUMN IF NOT EXISTS can_sign BOOLEAN NOT NULL DEFAULT false;

-- Backfill inicial: solo LEGAL y DIRECTOR_GENERAL activos como firmantes por defecto
UPDATE users
SET can_sign = true
WHERE role = 'AREA_USER'
  AND area IN ('LEGAL', 'DIRECTOR_GENERAL')
  AND is_active = true;
