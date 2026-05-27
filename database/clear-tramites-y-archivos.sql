-- =============================================================================
-- Limpia trámites, archivos y datos ligados (esquema español: tramites, archivos…).
-- NO borra: usuarios, configuracion_areas, enrutamiento, catálogos.
-- Los blobs en Azure se borran con el mismo flujo: npm run db:clear-tramites
-- =============================================================================

BEGIN;

DELETE FROM bloqueo_anotacion;
DELETE FROM comentarios_archivo;
DELETE FROM archivos_por_firmar;
DELETE FROM alertas_plazo_tramite;
DELETE FROM presencia_revision;
DELETE FROM tramite_areas_revision;
DELETE FROM tramite_areas_aprobadas;

UPDATE archivos SET archivo_fuente_firmado_id = NULL WHERE archivo_fuente_firmado_id IS NOT NULL;
UPDATE archivos SET archivo_padre_id = NULL WHERE archivo_padre_id IS NOT NULL;
DELETE FROM archivos;

DELETE FROM comentarios;
DELETE FROM registro_auditoria WHERE tramite_id IS NOT NULL;
DELETE FROM notificaciones WHERE tramite_id IS NOT NULL;

DELETE FROM tramites;

COMMIT;
