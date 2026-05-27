-- Permite restringir por área si el supervisor titular puede crear nuevos trámites.
-- Solo aplica cuando configuracion_areas.supervisor_id coincide con el usuario.

ALTER TABLE configuracion_areas
  ADD COLUMN IF NOT EXISTS supervisor_puede_crear_tramite BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN configuracion_areas.supervisor_puede_crear_tramite IS
  'Si el área tiene supervisor asignado y el usuario es ese supervisor: permite crear trámites nuevos.';
