-- ============================================
-- Documentación en catálogo: rol AREA_USER = supervisor de área
-- (el valor del enum NO cambia: sigue siendo AREA_USER)
-- ============================================

COMMENT ON COLUMN users.role IS
  'Rol del usuario: USER (crea trámites), AREA_USER (supervisor de área: revisa y aprueba en su etapa), ADMIN (administrador).';

COMMENT ON COLUMN users.area IS
  'Área asignada (obligatoria para AREA_USER / supervisor de área): COMERCIAL, TECNICA, FINANCIERA, LEGAL, DIRECTOR_GENERAL.';
