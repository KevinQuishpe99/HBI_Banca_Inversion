-- ════════════════════════════════════════════════════════════════════════
-- MIGRACION: Reestructuracion completa
-- - Tablas y columnas en espanol (sin tildes ni caracteres especiales)
-- - Normalizacion de areas: enum user_area → FK numerica a configuracion_areas.id
-- - Junction tables para arrays review_areas / approved_review_areas
-- - Eliminacion del enum user_area
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ════════════════════════════════════════════════════════════════
-- FASE 0: Eliminar objetos dependientes
-- ════════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS cases_with_creator CASCADE;

DROP FUNCTION IF EXISTS get_cases_for_user(UUID, user_role, user_area, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS get_cases_for_user(UUID, user_role_new, user_area, BOOLEAN) CASCADE;

DROP TRIGGER IF EXISTS trg_area_config_supervisor_ok ON area_config;
DROP TRIGGER IF EXISTS trg_users_supervisor_area_guard ON users;
DROP FUNCTION IF EXISTS area_config_supervisor_ok() CASCADE;
DROP FUNCTION IF EXISTS users_supervisor_area_guard() CASCADE;

DROP TRIGGER IF EXISTS trigger_case_changes ON cases;
DROP FUNCTION IF EXISTS log_case_changes() CASCADE;

-- ════════════════════════════════════════════════════════════════
-- FASE 1: Cambiar area_config.area de user_area a TEXT
-- ════════════════════════════════════════════════════════════════

ALTER TABLE area_config ALTER COLUMN area TYPE TEXT USING area::text;

-- ════════════════════════════════════════════════════════════════
-- FASE 2: Agregar columnas area_id (INTEGER) en todas las tablas
-- ════════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN IF NOT EXISTS area_id INTEGER;

ALTER TABLE cases ADD COLUMN IF NOT EXISTS area_actual_id INTEGER;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS area_creador_id INTEGER;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS area_supervision_id INTEGER;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS area_ultima_devolucion_id INTEGER;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='routing_creator_area' AND column_name='id') THEN
    ALTER TABLE routing_creator_area ADD COLUMN id SERIAL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='routing_creator_area' AND column_name='area_creador_id') THEN
    ALTER TABLE routing_creator_area ADD COLUMN area_creador_id INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='routing_creator_area' AND column_name='area_supervision_id') THEN
    ALTER TABLE routing_creator_area ADD COLUMN area_supervision_id INTEGER;
  END IF;
END $$;

ALTER TABLE files_to_sign ADD COLUMN IF NOT EXISTS area_requerida_id INTEGER;
ALTER TABLE file_annotation_lock ADD COLUMN IF NOT EXISTS area_usuario_id INTEGER;
ALTER TABLE case_review_presence ADD COLUMN IF NOT EXISTS area_usuario_id INTEGER;
ALTER TABLE file_comments ADD COLUMN IF NOT EXISTS area_usuario_id INTEGER;

-- ════════════════════════════════════════════════════════════════
-- FASE 3: Poblar area_id desde valores del enum
-- ════════════════════════════════════════════════════════════════

UPDATE users u SET area_id = ac.id
  FROM area_config ac WHERE ac.area = u.area::text AND u.area IS NOT NULL;

UPDATE cases c SET area_actual_id = ac.id
  FROM area_config ac WHERE ac.area = c.current_area::text AND c.current_area IS NOT NULL;

UPDATE cases c SET area_creador_id = ac.id
  FROM area_config ac WHERE ac.area = c.creator_area::text AND c.creator_area IS NOT NULL;

UPDATE cases c SET area_supervision_id = ac.id
  FROM area_config ac WHERE ac.area = c.supervision_area::text AND c.supervision_area IS NOT NULL;

UPDATE cases c SET area_ultima_devolucion_id = ac.id
  FROM area_config ac WHERE ac.area = c.last_return_area AND c.last_return_area IS NOT NULL;

UPDATE routing_creator_area r SET area_creador_id = ac.id
  FROM area_config ac WHERE ac.area = r.creator_area::text;

UPDATE routing_creator_area r SET area_supervision_id = ac.id
  FROM area_config ac WHERE ac.area = r.supervision_area::text AND r.supervision_area IS NOT NULL;

UPDATE files_to_sign f SET area_requerida_id = ac.id
  FROM area_config ac WHERE ac.area = f.required_by_area::text;

UPDATE file_annotation_lock f SET area_usuario_id = ac.id
  FROM area_config ac WHERE ac.area = f.user_area::text;

UPDATE case_review_presence cr SET area_usuario_id = ac.id
  FROM area_config ac WHERE ac.area = cr.user_area::text;

UPDATE file_comments fc SET area_usuario_id = ac.id
  FROM area_config ac WHERE ac.area = fc.user_area;

-- ════════════════════════════════════════════════════════════════
-- FASE 4: Crear junction tables para arrays de areas
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tramite_areas_revision (
  id SERIAL PRIMARY KEY,
  tramite_id UUID NOT NULL,
  area_id INTEGER NOT NULL,
  UNIQUE(tramite_id, area_id)
);

CREATE TABLE IF NOT EXISTS tramite_areas_aprobadas (
  id SERIAL PRIMARY KEY,
  tramite_id UUID NOT NULL,
  area_id INTEGER NOT NULL,
  UNIQUE(tramite_id, area_id)
);

INSERT INTO tramite_areas_revision (tramite_id, area_id)
SELECT c.id, ac.id
FROM cases c, unnest(c.review_areas) AS ra(area_val)
JOIN area_config ac ON ac.area = ra.area_val::text
WHERE c.review_areas IS NOT NULL AND array_length(c.review_areas, 1) > 0
ON CONFLICT DO NOTHING;

INSERT INTO tramite_areas_aprobadas (tramite_id, area_id)
SELECT c.id, ac.id
FROM cases c, unnest(c.approved_review_areas) AS aa(area_val)
JOIN area_config ac ON ac.area = aa.area_val::text
WHERE c.approved_review_areas IS NOT NULL AND array_length(c.approved_review_areas, 1) > 0
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════
-- FASE 5: Eliminar columnas enum antiguas
-- ════════════════════════════════════════════════════════════════

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_area_required_when_area_user;

ALTER TABLE routing_creator_area DROP CONSTRAINT IF EXISTS routing_creator_area_pkey;
ALTER TABLE routing_creator_area DROP CONSTRAINT IF EXISTS routing_supervision_ck;

ALTER TABLE users DROP COLUMN IF EXISTS area;
ALTER TABLE cases DROP COLUMN IF EXISTS current_area;
ALTER TABLE cases DROP COLUMN IF EXISTS creator_area;
ALTER TABLE cases DROP COLUMN IF EXISTS supervision_area;
ALTER TABLE cases DROP COLUMN IF EXISTS last_return_area;
ALTER TABLE cases DROP COLUMN IF EXISTS review_areas;
ALTER TABLE cases DROP COLUMN IF EXISTS approved_review_areas;
ALTER TABLE routing_creator_area DROP COLUMN IF EXISTS creator_area;
ALTER TABLE routing_creator_area DROP COLUMN IF EXISTS supervision_area;
ALTER TABLE files_to_sign DROP COLUMN IF EXISTS required_by_area;
ALTER TABLE file_annotation_lock DROP COLUMN IF EXISTS user_area;
ALTER TABLE case_review_presence DROP COLUMN IF EXISTS user_area;
ALTER TABLE file_comments DROP COLUMN IF EXISTS user_area;

-- ════════════════════════════════════════════════════════════════
-- FASE 6: FK constraints y NOT NULL
-- ════════════════════════════════════════════════════════════════

ALTER TABLE users ADD CONSTRAINT fk_usuarios_area
  FOREIGN KEY (area_id) REFERENCES area_config(id);
ALTER TABLE users ADD CONSTRAINT usuarios_area_requerida_para_area_user
  CHECK (role::text IS DISTINCT FROM 'AREA_USER' OR area_id IS NOT NULL);

ALTER TABLE cases ADD CONSTRAINT fk_tramites_area_actual
  FOREIGN KEY (area_actual_id) REFERENCES area_config(id);
ALTER TABLE cases ADD CONSTRAINT fk_tramites_area_creador
  FOREIGN KEY (area_creador_id) REFERENCES area_config(id);
ALTER TABLE cases ADD CONSTRAINT fk_tramites_area_supervision
  FOREIGN KEY (area_supervision_id) REFERENCES area_config(id);
ALTER TABLE cases ADD CONSTRAINT fk_tramites_area_devolucion
  FOREIGN KEY (area_ultima_devolucion_id) REFERENCES area_config(id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='routing_creator_area_pkey') THEN
    ALTER TABLE routing_creator_area ADD PRIMARY KEY (id);
  END IF;
END $$;
ALTER TABLE routing_creator_area ALTER COLUMN area_creador_id SET NOT NULL;
ALTER TABLE routing_creator_area ADD CONSTRAINT uq_enrutamiento_area_creador UNIQUE (area_creador_id);
ALTER TABLE routing_creator_area ADD CONSTRAINT fk_enrutamiento_area_creador
  FOREIGN KEY (area_creador_id) REFERENCES area_config(id);
ALTER TABLE routing_creator_area ADD CONSTRAINT fk_enrutamiento_area_supervision
  FOREIGN KEY (area_supervision_id) REFERENCES area_config(id);
ALTER TABLE routing_creator_area ADD CONSTRAINT enrutamiento_supervision_ck CHECK (
  (flow_kind = 'DIRECT_LEGAL' AND area_supervision_id IS NULL)
  OR (flow_kind = 'SUPERVISION_CHAIN' AND area_supervision_id IS NOT NULL)
);

ALTER TABLE files_to_sign ALTER COLUMN area_requerida_id SET NOT NULL;
ALTER TABLE files_to_sign ADD CONSTRAINT fk_archivos_firmar_area
  FOREIGN KEY (area_requerida_id) REFERENCES area_config(id);

ALTER TABLE file_annotation_lock ADD CONSTRAINT fk_bloqueo_anotacion_area
  FOREIGN KEY (area_usuario_id) REFERENCES area_config(id);

ALTER TABLE case_review_presence ADD CONSTRAINT fk_presencia_area
  FOREIGN KEY (area_usuario_id) REFERENCES area_config(id);

ALTER TABLE file_comments ADD CONSTRAINT fk_comentarios_archivo_area
  FOREIGN KEY (area_usuario_id) REFERENCES area_config(id);

ALTER TABLE tramite_areas_revision ADD CONSTRAINT fk_tar_tramite
  FOREIGN KEY (tramite_id) REFERENCES cases(id) ON DELETE CASCADE;
ALTER TABLE tramite_areas_revision ADD CONSTRAINT fk_tar_area
  FOREIGN KEY (area_id) REFERENCES area_config(id);

ALTER TABLE tramite_areas_aprobadas ADD CONSTRAINT fk_taa_tramite
  FOREIGN KEY (tramite_id) REFERENCES cases(id) ON DELETE CASCADE;
ALTER TABLE tramite_areas_aprobadas ADD CONSTRAINT fk_taa_area
  FOREIGN KEY (area_id) REFERENCES area_config(id);

-- ════════════════════════════════════════════════════════════════
-- FASE 7: Renombrar tablas
-- ════════════════════════════════════════════════════════════════

ALTER TABLE users RENAME TO usuarios;
ALTER TABLE cases RENAME TO tramites;
ALTER TABLE files RENAME TO archivos;
ALTER TABLE audit_log RENAME TO registro_auditoria;
ALTER TABLE comments RENAME TO comentarios;
ALTER TABLE notifications RENAME TO notificaciones;
ALTER TABLE area_config RENAME TO configuracion_areas;
ALTER TABLE routing_creator_area RENAME TO enrutamiento_area_creador;
ALTER TABLE case_status_config RENAME TO configuracion_estados;
ALTER TABLE document_type_config RENAME TO configuracion_tipos_documento;
ALTER TABLE signature_type_config RENAME TO configuracion_tipos_firma;
ALTER TABLE template_type_config RENAME TO configuracion_tipos_plantilla;
ALTER TABLE file_comments RENAME TO comentarios_archivo;
ALTER TABLE files_to_sign RENAME TO archivos_por_firmar;
ALTER TABLE file_annotation_lock RENAME TO bloqueo_anotacion;
ALTER TABLE case_review_presence RENAME TO presencia_revision;
ALTER TABLE app_settings RENAME TO configuracion_app;
ALTER TABLE case_deadline_alerts RENAME TO alertas_plazo_tramite;

-- ════════════════════════════════════════════════════════════════
-- FASE 8: Renombrar columnas
-- ════════════════════════════════════════════════════════════════

-- usuarios
ALTER TABLE usuarios RENAME COLUMN password_hash TO hash_contrasena;
ALTER TABLE usuarios RENAME COLUMN first_name TO nombre;
ALTER TABLE usuarios RENAME COLUMN last_name TO apellido;
ALTER TABLE usuarios RENAME COLUMN role TO rol;
ALTER TABLE usuarios RENAME COLUMN is_active TO activo;
ALTER TABLE usuarios RENAME COLUMN can_sign TO puede_firmar;
ALTER TABLE usuarios RENAME COLUMN created_at TO creado_en;
ALTER TABLE usuarios RENAME COLUMN updated_at TO actualizado_en;
ALTER TABLE usuarios RENAME COLUMN last_login TO ultimo_acceso;

-- tramites
ALTER TABLE tramites RENAME COLUMN case_number TO numero_tramite;
ALTER TABLE tramites RENAME COLUMN title TO titulo;
ALTER TABLE tramites RENAME COLUMN description TO descripcion;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='tramites' AND column_name='status') THEN
    ALTER TABLE tramites RENAME COLUMN status TO estado;
  END IF;
END $$;
ALTER TABLE tramites RENAME COLUMN created_by TO creado_por;
ALTER TABLE tramites RENAME COLUMN due_date TO fecha_limite;
ALTER TABLE tramites RENAME COLUMN completed_at TO completado_en;
ALTER TABLE tramites RENAME COLUMN created_at TO creado_en;
ALTER TABLE tramites RENAME COLUMN updated_at TO actualizado_en;
ALTER TABLE tramites RENAME COLUMN advisor_name TO nombre_asesor;
ALTER TABLE tramites RENAME COLUMN document_file_name TO nombre_archivo_documento;
ALTER TABLE tramites RENAME COLUMN odoo_code TO codigo_odoo;
ALTER TABLE tramites RENAME COLUMN client_provider TO cliente_proveedor;
ALTER TABLE tramites RENAME COLUMN document_type TO tipo_documento;
ALTER TABLE tramites RENAME COLUMN sharepoint_url TO url_sharepoint;
ALTER TABLE tramites RENAME COLUMN request_date TO fecha_solicitud;
ALTER TABLE tramites RENAME COLUMN required_delivery_date TO fecha_entrega_requerida;
ALTER TABLE tramites RENAME COLUMN urgency_justification TO justificacion_urgencia;
ALTER TABLE tramites RENAME COLUMN signature_type TO tipo_firma;
ALTER TABLE tramites RENAME COLUMN template_type TO tipo_plantilla;
ALTER TABLE tramites RENAME COLUMN observations TO observaciones;
ALTER TABLE tramites RENAME COLUMN return_allow_file_update TO permite_actualizacion_devolucion;
ALTER TABLE tramites RENAME COLUMN last_return_reason TO motivo_ultima_devolucion;
ALTER TABLE tramites RENAME COLUMN return_history TO historial_devoluciones;
ALTER TABLE tramites RENAME COLUMN routing_flow TO tipo_flujo;
ALTER TABLE tramites RENAME COLUMN supervision_completed TO supervision_completada;
ALTER TABLE tramites RENAME COLUMN amount_applies TO aplica_monto;
ALTER TABLE tramites RENAME COLUMN amount_value TO valor_monto;

-- archivos
ALTER TABLE archivos RENAME COLUMN case_id TO tramite_id;
ALTER TABLE archivos RENAME COLUMN file_name TO nombre_archivo;
ALTER TABLE archivos RENAME COLUMN file_type TO tipo_archivo;
ALTER TABLE archivos RENAME COLUMN file_size TO tamano_archivo;
ALTER TABLE archivos RENAME COLUMN mime_type TO tipo_mime;
ALTER TABLE archivos RENAME COLUMN description TO descripcion;
ALTER TABLE archivos RENAME COLUMN signature_reason TO motivo_firma;
ALTER TABLE archivos RENAME COLUMN blob_url TO url_blob;
ALTER TABLE archivos RENAME COLUMN blob_path TO ruta_blob;
ALTER TABLE archivos RENAME COLUMN parent_file_id TO archivo_padre_id;
ALTER TABLE archivos RENAME COLUMN is_final TO es_final;
ALTER TABLE archivos RENAME COLUMN is_deleted TO eliminado;
ALTER TABLE archivos RENAME COLUMN uploaded_by TO subido_por;
ALTER TABLE archivos RENAME COLUMN uploaded_at TO subido_en;
ALTER TABLE archivos RENAME COLUMN deleted_at TO eliminado_en;
ALTER TABLE archivos RENAME COLUMN is_creation_upload TO es_carga_inicial;
ALTER TABLE archivos RENAME COLUMN is_signed TO firmado;
ALTER TABLE archivos RENAME COLUMN signed_source_file_id TO archivo_fuente_firmado_id;

-- registro_auditoria
ALTER TABLE registro_auditoria RENAME COLUMN case_id TO tramite_id;
ALTER TABLE registro_auditoria RENAME COLUMN user_id TO usuario_id;
ALTER TABLE registro_auditoria RENAME COLUMN action TO accion;
ALTER TABLE registro_auditoria RENAME COLUMN entity_type TO tipo_entidad;
ALTER TABLE registro_auditoria RENAME COLUMN entity_id TO entidad_id;
ALTER TABLE registro_auditoria RENAME COLUMN old_value TO valor_anterior;
ALTER TABLE registro_auditoria RENAME COLUMN new_value TO valor_nuevo;
ALTER TABLE registro_auditoria RENAME COLUMN comments TO comentario;
ALTER TABLE registro_auditoria RENAME COLUMN created_at TO creado_en;

-- comentarios
ALTER TABLE comentarios RENAME COLUMN case_id TO tramite_id;
ALTER TABLE comentarios RENAME COLUMN user_id TO usuario_id;
ALTER TABLE comentarios RENAME COLUMN content TO contenido;
ALTER TABLE comentarios RENAME COLUMN is_internal TO es_interno;
ALTER TABLE comentarios RENAME COLUMN created_at TO creado_en;
ALTER TABLE comentarios RENAME COLUMN updated_at TO actualizado_en;

-- notificaciones
ALTER TABLE notificaciones RENAME COLUMN user_id TO usuario_id;
ALTER TABLE notificaciones RENAME COLUMN case_id TO tramite_id;
ALTER TABLE notificaciones RENAME COLUMN type TO tipo;
ALTER TABLE notificaciones RENAME COLUMN title TO titulo;
ALTER TABLE notificaciones RENAME COLUMN message TO mensaje;
ALTER TABLE notificaciones RENAME COLUMN is_read TO leido;
ALTER TABLE notificaciones RENAME COLUMN read_at TO leido_en;
ALTER TABLE notificaciones RENAME COLUMN created_at TO creado_en;

-- configuracion_areas
ALTER TABLE configuracion_areas RENAME COLUMN area TO codigo;
ALTER TABLE configuracion_areas RENAME COLUMN label TO nombre;
ALTER TABLE configuracion_areas RENAME COLUMN is_active TO activo;
ALTER TABLE configuracion_areas RENAME COLUMN is_selectable TO seleccionable;
ALTER TABLE configuracion_areas RENAME COLUMN is_mandatory TO obligatorio;
ALTER TABLE configuracion_areas RENAME COLUMN sort_order TO orden;
ALTER TABLE configuracion_areas RENAME COLUMN is_final_step TO es_paso_final;
ALTER TABLE configuracion_areas RENAME COLUMN notify_on_high_amount TO notificar_monto_alto;
ALTER TABLE configuracion_areas RENAME COLUMN allows_signing TO permite_firma;
ALTER TABLE configuracion_areas RENAME COLUMN can_complete_case TO puede_completar_tramite;

-- enrutamiento_area_creador
ALTER TABLE enrutamiento_area_creador RENAME COLUMN flow_kind TO tipo_flujo;

-- configuracion_estados
ALTER TABLE configuracion_estados RENAME COLUMN code TO codigo;
ALTER TABLE configuracion_estados RENAME COLUMN label TO nombre;
ALTER TABLE configuracion_estados RENAME COLUMN variant TO variante;
ALTER TABLE configuracion_estados RENAME COLUMN sort_order TO orden;
ALTER TABLE configuracion_estados RENAME COLUMN is_active TO activo;

-- configuracion_tipos_documento
ALTER TABLE configuracion_tipos_documento RENAME COLUMN code TO codigo;
ALTER TABLE configuracion_tipos_documento RENAME COLUMN label TO nombre;
ALTER TABLE configuracion_tipos_documento RENAME COLUMN is_active TO activo;
ALTER TABLE configuracion_tipos_documento RENAME COLUMN sort_order TO orden;

-- configuracion_tipos_firma
ALTER TABLE configuracion_tipos_firma RENAME COLUMN code TO codigo;
ALTER TABLE configuracion_tipos_firma RENAME COLUMN label TO nombre;
ALTER TABLE configuracion_tipos_firma RENAME COLUMN is_active TO activo;
ALTER TABLE configuracion_tipos_firma RENAME COLUMN sort_order TO orden;

-- configuracion_tipos_plantilla
ALTER TABLE configuracion_tipos_plantilla RENAME COLUMN code TO codigo;
ALTER TABLE configuracion_tipos_plantilla RENAME COLUMN label TO nombre;
ALTER TABLE configuracion_tipos_plantilla RENAME COLUMN is_active TO activo;
ALTER TABLE configuracion_tipos_plantilla RENAME COLUMN sort_order TO orden;

-- comentarios_archivo
ALTER TABLE comentarios_archivo RENAME COLUMN case_id TO tramite_id;
ALTER TABLE comentarios_archivo RENAME COLUMN file_id TO archivo_id;
ALTER TABLE comentarios_archivo RENAME COLUMN user_id TO usuario_id;
ALTER TABLE comentarios_archivo RENAME COLUMN content TO contenido;
ALTER TABLE comentarios_archivo RENAME COLUMN created_at TO creado_en;

-- archivos_por_firmar
ALTER TABLE archivos_por_firmar RENAME COLUMN case_id TO tramite_id;
ALTER TABLE archivos_por_firmar RENAME COLUMN file_id TO archivo_id;
ALTER TABLE archivos_por_firmar RENAME COLUMN is_signed TO firmado;
ALTER TABLE archivos_por_firmar RENAME COLUMN created_at TO creado_en;

-- bloqueo_anotacion
ALTER TABLE bloqueo_anotacion RENAME COLUMN file_id TO archivo_id;
ALTER TABLE bloqueo_anotacion RENAME COLUMN user_id TO usuario_id;
ALTER TABLE bloqueo_anotacion RENAME COLUMN last_heartbeat TO ultimo_latido;

-- presencia_revision
ALTER TABLE presencia_revision RENAME COLUMN case_id TO tramite_id;
ALTER TABLE presencia_revision RENAME COLUMN user_id TO usuario_id;
ALTER TABLE presencia_revision RENAME COLUMN last_seen_at TO ultimo_visto_en;

-- configuracion_app
ALTER TABLE configuracion_app RENAME COLUMN key TO clave;
ALTER TABLE configuracion_app RENAME COLUMN value_numeric TO valor_numerico;
ALTER TABLE configuracion_app RENAME COLUMN updated_at TO actualizado_en;

-- alertas_plazo_tramite
ALTER TABLE alertas_plazo_tramite RENAME COLUMN case_id TO tramite_id;
ALTER TABLE alertas_plazo_tramite RENAME COLUMN alert_tier TO nivel_alerta;
ALTER TABLE alertas_plazo_tramite RENAME COLUMN sent_at TO enviado_en;

-- ════════════════════════════════════════════════════════════════
-- FASE 9: Recrear vista
-- ════════════════════════════════════════════════════════════════

CREATE VIEW vista_tramites_creador AS
SELECT
  t.*,
  u.nombre || ' ' || u.apellido AS nombre_creador,
  u.email AS email_creador,
  (SELECT COUNT(*) FROM archivos WHERE tramite_id = t.id AND eliminado = false) AS cantidad_archivos,
  (SELECT COUNT(*) FROM comentarios WHERE tramite_id = t.id) AS cantidad_comentarios
FROM tramites t
JOIN usuarios u ON t.creado_por = u.id;

-- ════════════════════════════════════════════════════════════════
-- FASE 10: Recrear funcion obtener_tramites_usuario
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION obtener_tramites_usuario(
    p_usuario_id UUID,
    p_rol user_role,
    p_area_id INTEGER,
    p_solo_asignados BOOLEAN DEFAULT false
)
RETURNS TABLE (
    id UUID,
    numero_tramite VARCHAR,
    titulo VARCHAR,
    descripcion TEXT,
    estado estado_tramite,
    creado_por UUID,
    area_actual_id INTEGER,
    creado_en TIMESTAMP WITH TIME ZONE,
    actualizado_en TIMESTAMP WITH TIME ZONE,
    completado_en TIMESTAMP WITH TIME ZONE,
    fecha_limite TIMESTAMP WITH TIME ZONE,
    nombre_creador TEXT,
    email_creador VARCHAR,
    cantidad_archivos BIGINT,
    cantidad_comentarios BIGINT,
    nombre_asesor VARCHAR,
    nombre_archivo_documento VARCHAR,
    codigo_odoo VARCHAR,
    cliente_proveedor VARCHAR,
    tipo_documento document_type,
    url_sharepoint TEXT,
    fecha_solicitud TIMESTAMP WITH TIME ZONE,
    fecha_entrega_requerida TIMESTAMP WITH TIME ZONE,
    justificacion_urgencia TEXT,
    tipo_firma signature_type,
    tipo_plantilla template_type,
    observaciones TEXT,
    permite_actualizacion_devolucion BOOLEAN,
    motivo_ultima_devolucion TEXT,
    area_ultima_devolucion_id INTEGER,
    historial_devoluciones JSONB,
    area_creador_id INTEGER,
    tipo_flujo TEXT,
    area_supervision_id INTEGER,
    supervision_completada BOOLEAN,
    aplica_monto BOOLEAN,
    valor_monto NUMERIC(18,2)
) AS $$
BEGIN
    IF p_rol = 'ADMIN' THEN
        RETURN QUERY
        SELECT t.id, t.numero_tramite, t.titulo, t.descripcion, t.estado,
          t.creado_por, t.area_actual_id, t.creado_en, t.actualizado_en,
          t.completado_en, t.fecha_limite,
          u.nombre || ' ' || u.apellido,
          u.email,
          (SELECT COUNT(*) FROM archivos WHERE tramite_id = t.id AND eliminado = false)::BIGINT,
          (SELECT COUNT(*) FROM comentarios WHERE tramite_id = t.id)::BIGINT,
          t.nombre_asesor, t.nombre_archivo_documento, t.codigo_odoo, t.cliente_proveedor,
          t.tipo_documento, t.url_sharepoint, t.fecha_solicitud, t.fecha_entrega_requerida,
          t.justificacion_urgencia, t.tipo_firma, t.tipo_plantilla, t.observaciones,
          COALESCE(t.permite_actualizacion_devolucion, false),
          t.motivo_ultima_devolucion, t.area_ultima_devolucion_id,
          t.historial_devoluciones,
          t.area_creador_id, t.tipo_flujo, t.area_supervision_id, t.supervision_completada,
          t.aplica_monto, t.valor_monto
        FROM tramites t
        JOIN usuarios u ON t.creado_por = u.id
        ORDER BY t.creado_en DESC;

    ELSIF p_rol = 'USER' THEN
        RETURN QUERY
        SELECT t.id, t.numero_tramite, t.titulo, t.descripcion, t.estado,
          t.creado_por, t.area_actual_id, t.creado_en, t.actualizado_en,
          t.completado_en, t.fecha_limite,
          u.nombre || ' ' || u.apellido,
          u.email,
          (SELECT COUNT(*) FROM archivos WHERE tramite_id = t.id AND eliminado = false)::BIGINT,
          (SELECT COUNT(*) FROM comentarios WHERE tramite_id = t.id)::BIGINT,
          t.nombre_asesor, t.nombre_archivo_documento, t.codigo_odoo, t.cliente_proveedor,
          t.tipo_documento, t.url_sharepoint, t.fecha_solicitud, t.fecha_entrega_requerida,
          t.justificacion_urgencia, t.tipo_firma, t.tipo_plantilla, t.observaciones,
          COALESCE(t.permite_actualizacion_devolucion, false),
          t.motivo_ultima_devolucion, t.area_ultima_devolucion_id,
          t.historial_devoluciones,
          t.area_creador_id, t.tipo_flujo, t.area_supervision_id, t.supervision_completada,
          t.aplica_monto, t.valor_monto
        FROM tramites t
        JOIN usuarios u ON t.creado_por = u.id
        WHERE t.creado_por = p_usuario_id
        ORDER BY t.creado_en DESC;

    ELSE
        IF p_solo_asignados THEN
            RETURN QUERY
            SELECT t.id, t.numero_tramite, t.titulo, t.descripcion, t.estado,
              t.creado_por, t.area_actual_id, t.creado_en, t.actualizado_en,
              t.completado_en, t.fecha_limite,
              u.nombre || ' ' || u.apellido,
              u.email,
              (SELECT COUNT(*) FROM archivos WHERE tramite_id = t.id AND eliminado = false)::BIGINT,
              (SELECT COUNT(*) FROM comentarios WHERE tramite_id = t.id)::BIGINT,
              t.nombre_asesor, t.nombre_archivo_documento, t.codigo_odoo, t.cliente_proveedor,
              t.tipo_documento, t.url_sharepoint, t.fecha_solicitud, t.fecha_entrega_requerida,
              t.justificacion_urgencia, t.tipo_firma, t.tipo_plantilla, t.observaciones,
              COALESCE(t.permite_actualizacion_devolucion, false),
              t.motivo_ultima_devolucion, t.area_ultima_devolucion_id,
              t.historial_devoluciones,
              t.area_creador_id, t.tipo_flujo, t.area_supervision_id, t.supervision_completada,
              t.aplica_monto, t.valor_monto
            FROM tramites t
            JOIN usuarios u ON t.creado_por = u.id
            WHERE t.estado = 'EN_REVISION'::estado_tramite
              AND (
                (
                  NOT EXISTS (SELECT 1 FROM tramite_areas_aprobadas taa
                    WHERE taa.tramite_id = t.id AND taa.area_id = p_area_id)
                  AND (
                    EXISTS (SELECT 1 FROM tramite_areas_revision tar
                      WHERE tar.tramite_id = t.id AND tar.area_id = p_area_id)
                    OR EXISTS (
                      SELECT 1 FROM configuracion_areas ca
                      WHERE ca.id = p_area_id AND ca.obligatorio = true AND ca.activo = true
                    )
                  )
                )
                OR (
                  EXISTS (SELECT 1 FROM configuracion_areas ca
                    WHERE ca.id = p_area_id AND ca.es_paso_final = true)
                  AND t.estado IN ('TRAMITE_ENVIADO'::estado_tramite, 'EN_REVISION'::estado_tramite)
                )
              )
            ORDER BY t.creado_en DESC;
        ELSE
            RETURN QUERY
            SELECT t.id, t.numero_tramite, t.titulo, t.descripcion, t.estado,
              t.creado_por, t.area_actual_id, t.creado_en, t.actualizado_en,
              t.completado_en, t.fecha_limite,
              u.nombre || ' ' || u.apellido,
              u.email,
              (SELECT COUNT(*) FROM archivos WHERE tramite_id = t.id AND eliminado = false)::BIGINT,
              (SELECT COUNT(*) FROM comentarios WHERE tramite_id = t.id)::BIGINT,
              t.nombre_asesor, t.nombre_archivo_documento, t.codigo_odoo, t.cliente_proveedor,
              t.tipo_documento, t.url_sharepoint, t.fecha_solicitud, t.fecha_entrega_requerida,
              t.justificacion_urgencia, t.tipo_firma, t.tipo_plantilla, t.observaciones,
              COALESCE(t.permite_actualizacion_devolucion, false),
              t.motivo_ultima_devolucion, t.area_ultima_devolucion_id,
              t.historial_devoluciones,
              t.area_creador_id, t.tipo_flujo, t.area_supervision_id, t.supervision_completada,
              t.aplica_monto, t.valor_monto
            FROM tramites t
            JOIN usuarios u ON t.creado_por = u.id
            ORDER BY t.creado_en DESC;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ════════════════════════════════════════════════════════════════
-- FASE 11: Recrear triggers con nuevos nombres
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION validar_supervisor_area() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.supervisor_id IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = NEW.supervisor_id
      AND u.rol::text = 'AREA_USER'
      AND u.area_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'El supervisor debe ser un usuario de area asignado a esta area';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_supervisor_area
  BEFORE INSERT OR UPDATE OF supervisor_id ON configuracion_areas
  FOR EACH ROW EXECUTE FUNCTION validar_supervisor_area();

CREATE OR REPLACE FUNCTION proteger_area_supervisor() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF EXISTS (
      SELECT 1 FROM configuracion_areas ca
      WHERE ca.supervisor_id = NEW.id
        AND (
          NEW.rol::text IS DISTINCT FROM 'AREA_USER'
          OR NEW.area_id IS NULL
          OR ca.id IS DISTINCT FROM NEW.area_id
        )
    ) THEN
      RAISE EXCEPTION 'No puede cambiar el area ni el rol de un usuario que es supervisor';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_proteger_area_supervisor
  BEFORE UPDATE OF rol, area_id ON usuarios
  FOR EACH ROW EXECUTE FUNCTION proteger_area_supervisor();

-- ════════════════════════════════════════════════════════════════
-- FASE 12: Eliminar enum user_area
-- ════════════════════════════════════════════════════════════════

DROP TYPE IF EXISTS user_area CASCADE;

-- ════════════════════════════════════════════════════════════════
-- FASE 13: Indices en junction tables
-- ════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_tar_tramite ON tramite_areas_revision(tramite_id);
CREATE INDEX IF NOT EXISTS idx_tar_area ON tramite_areas_revision(area_id);
CREATE INDEX IF NOT EXISTS idx_taa_tramite ON tramite_areas_aprobadas(tramite_id);
CREATE INDEX IF NOT EXISTS idx_taa_area ON tramite_areas_aprobadas(area_id);

-- ════════════════════════════════════════════════════════════════
-- FASE 14: Trigger generate_case_number → tramites / numero_tramite
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION generate_case_number()
RETURNS TRIGGER AS $gcn$
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
$gcn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS generate_case_number_trigger ON tramites;
DROP TRIGGER IF EXISTS generate_case_number_trigger ON cases;

CREATE TRIGGER generate_case_number_trigger
    BEFORE INSERT ON tramites
    FOR EACH ROW
    WHEN (NEW.numero_tramite IS NULL)
    EXECUTE FUNCTION generate_case_number();

-- ════════════════════════════════════════════════════════════════
-- FASE 15: Trigger updated_at → actualizado_en en tablas renombradas
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $fn$
BEGIN
  IF TG_TABLE_SCHEMA = 'public' AND TG_TABLE_NAME IN (
    'usuarios', 'tramites', 'comentarios', 'configuracion_app'
  ) THEN
    NEW.actualizado_en := CURRENT_TIMESTAMP;
  ELSE
    NEW.updated_at := CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

COMMIT;
