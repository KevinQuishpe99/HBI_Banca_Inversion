-- Corrige obtener_tramites_usuario tras renombrar tablas/columnas.
-- Devuelve estado como TEXT (t.estado::text) para funcionar con enum estado_tramite o case_status.
-- Comparaciones usan texto para aceptar EN_REVISION/IN_REVIEW y TRAMITE_ENVIADO/SUBMITTED.

DROP FUNCTION IF EXISTS obtener_tramites_usuario(UUID, user_role, INTEGER, BOOLEAN);

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
    estado TEXT,
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
) AS $fn$
BEGIN
    IF p_rol = 'ADMIN' THEN
        RETURN QUERY
        SELECT t.id, t.numero_tramite, t.titulo, t.descripcion, t.estado::text,
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
        SELECT t.id, t.numero_tramite, t.titulo, t.descripcion, t.estado::text,
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
            SELECT t.id, t.numero_tramite, t.titulo, t.descripcion, t.estado::text,
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
            WHERE (t.estado::text) IN ('EN_REVISION', 'IN_REVIEW')
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
                  AND (t.estado::text) IN ('TRAMITE_ENVIADO', 'SUBMITTED', 'EN_REVISION', 'IN_REVIEW')
                )
              )
            ORDER BY t.creado_en DESC;
        ELSE
            RETURN QUERY
            SELECT t.id, t.numero_tramite, t.titulo, t.descripcion, t.estado::text,
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
$fn$ LANGUAGE plpgsql;
