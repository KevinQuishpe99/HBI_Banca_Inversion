-- tramites.estado_id → configuracion_estados(id). Catálogo sin columna de código/valor técnico.
-- IDs fijos: 1 enviado, 2 en revisión, 3 revisado, 4 devuelto, 5 completado (alineado con lib/db/estado-tramite-map.ts).
-- Ejecutar: npm run db:migrate-tramites-estado-config-fk
-- Tablas tocadas: tramites (columna estado enum → estado_id FK), configuracion_estados (solo id + presentación).

BEGIN;

ALTER TABLE public.tramites DROP CONSTRAINT IF EXISTS tramites_estado_id_fkey;

ALTER TABLE public.tramites ADD COLUMN IF NOT EXISTS estado_id INTEGER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tramites' AND column_name = 'estado'
  ) THEN
    UPDATE public.tramites
    SET estado_id = CASE trim(estado::text)
      WHEN 'TRAMITE_ENVIADO' THEN 1
      WHEN 'SUBMITTED' THEN 1
      WHEN 'EN_REVISION' THEN 2
      WHEN 'IN_REVIEW' THEN 2
      WHEN 'REVISADO' THEN 3
      WHEN 'APPROVED' THEN 3
      WHEN 'DEVUELTO' THEN 4
      WHEN 'RETURNED' THEN 4
      WHEN 'TRAMITE_COMPLETADO' THEN 5
      WHEN 'COMPLETED' THEN 5
      ELSE 1
    END
    WHERE estado_id IS NULL;
  END IF;
END $$;

UPDATE public.tramites SET estado_id = 1 WHERE estado_id IS NULL;

ALTER TABLE public.configuracion_estados DROP COLUMN IF EXISTS valor_tramite;
ALTER TABLE public.configuracion_estados DROP COLUMN IF EXISTS codigo;
ALTER TABLE public.configuracion_estados DROP COLUMN IF EXISTS code;

DELETE FROM public.configuracion_estados;

INSERT INTO public.configuracion_estados (id, nombre, variante, orden, activo) VALUES
  (1, 'Trámite enviado', 'blue', 20, true),
  (2, 'En revisión', 'yellow', 30, true),
  (3, 'Revisado', 'green', 40, false),
  (4, 'Devuelto', 'orange', 50, true),
  (5, 'Trámite completado', 'emerald', 60, true);

DO $$
DECLARE
  seq text;
BEGIN
  seq := pg_get_serial_sequence('public.configuracion_estados', 'id');
  IF seq IS NOT NULL THEN
    PERFORM setval(seq, (SELECT COALESCE(MAX(id), 1) FROM public.configuracion_estados));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.configuracion_estados'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.configuracion_estados ADD CONSTRAINT configuracion_estados_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- La vista usa t.*; debe eliminarse antes de quitar la columna estado.
DROP VIEW IF EXISTS public.vista_tramites_creador;

ALTER TABLE public.tramites DROP COLUMN IF EXISTS estado;

ALTER TABLE public.tramites ALTER COLUMN estado_id SET NOT NULL;

ALTER TABLE public.tramites
  ADD CONSTRAINT tramites_estado_id_fkey
  FOREIGN KEY (estado_id) REFERENCES public.configuracion_estados(id);

CREATE OR REPLACE VIEW public.vista_tramites_creador AS
SELECT
  t.*,
  u.nombre || ' ' || u.apellido AS nombre_creador,
  u.email AS email_creador,
  (SELECT COUNT(*) FROM archivos WHERE tramite_id = t.id AND eliminado = false) AS cantidad_archivos,
  (SELECT COUNT(*) FROM comentarios WHERE tramite_id = t.id) AS cantidad_comentarios
FROM tramites t
JOIN usuarios u ON t.creado_por = u.id;

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
    estado INTEGER,
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
        SELECT t.id, t.numero_tramite, t.titulo, t.descripcion, t.estado_id AS estado,
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
        SELECT t.id, t.numero_tramite, t.titulo, t.descripcion, t.estado_id AS estado,
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
            SELECT t.id, t.numero_tramite, t.titulo, t.descripcion, t.estado_id AS estado,
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
            WHERE t.estado_id = 2
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
                  AND t.estado_id IN (1, 2)
                )
              )
            ORDER BY t.creado_en DESC;
        ELSE
            RETURN QUERY
            SELECT t.id, t.numero_tramite, t.titulo, t.descripcion, t.estado_id AS estado,
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

DROP TYPE IF EXISTS public.estado_tramite;

COMMIT;
