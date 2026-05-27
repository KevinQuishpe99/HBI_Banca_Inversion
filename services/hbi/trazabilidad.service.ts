import { query } from '@/lib/db';
import type {
  CorreoEnviadoHbi,
  EventoTrazabilidad,
  TipoServicioHbi,
} from '@/types/hbi/operacion.types';

export class TrazabilidadHbiService {
  /** Línea de tiempo unificada: historial, documentos, correos recibidos/enviados, actividades. */
  static async lineaTiempo(operacionId: string): Promise<EventoTrazabilidad[]> {
    const eventos: EventoTrazabilidad[] = [];

    const [hist, docs, correosOp, correosEnviados, actividades] = await Promise.all([
      query<{
        id: string;
        tipo_evento: string;
        comentario: string | null;
        detalle: Record<string, unknown>;
        fase_anterior: string | null;
        fase_nueva: string | null;
        creado_en: string;
        nombre: string | null;
        apellido: string | null;
      }>(
        `SELECT h.id, h.tipo_evento, h.comentario, h.detalle, h.fase_anterior, h.fase_nueva, h.creado_en,
                u.nombre, u.apellido
         FROM historial_operacion h
         LEFT JOIN usuarios u ON u.id = h.usuario_id
         WHERE h.operacion_id = $1
         ORDER BY h.creado_en DESC`,
        [operacionId]
      ),
      query<{
        id: string;
        nombre_archivo: string;
        tipo_documento: string;
        creado_en: string;
        nombre: string | null;
        apellido: string | null;
      }>(
        `SELECT d.id, d.nombre_archivo, d.tipo_documento, d.creado_en, u.nombre, u.apellido
         FROM documentos_contractuales d
         LEFT JOIN usuarios u ON u.id = d.subido_por
         WHERE d.operacion_id = $1`,
        [operacionId]
      ),
      query<{
        id: string;
        remitente: string;
        asunto: string;
        origen: string;
        prioridad: string;
        direccion: string;
        creado_en: string;
      }>(
        `SELECT id, remitente, asunto, origen, prioridad,
                COALESCE(direccion, 'RECIBIDO') AS direccion, creado_en
         FROM correos_operacion WHERE operacion_id = $1`,
        [operacionId]
      ),
      TrazabilidadHbiService.listarCorreosEnviados(operacionId).catch(() => [] as CorreoEnviadoHbi[]),
      query<{
        id: string;
        titulo: string;
        tipo_servicio: TipoServicioHbi;
        estado: string;
        creado_en: string;
        actualizado_en: string;
      }>(
        `SELECT id, titulo, tipo_servicio, estado, creado_en, actualizado_en
         FROM actividades_servicio WHERE operacion_id = $1`,
        [operacionId]
      ),
    ]);

    for (const h of hist.rows) {
      const esFase = h.tipo_evento === 'CAMBIO_FASE' || h.fase_nueva != null;
      eventos.push({
        id: `hist-${h.id}`,
        tipo: esFase ? 'CAMBIO_FASE' : 'HISTORIAL',
        titulo: etiquetaHistorial(h.tipo_evento),
        descripcion: h.comentario ?? undefined,
        usuarioNombre: nombreUsuario(h.nombre, h.apellido),
        detalle: {
          ...h.detalle,
          faseAnterior: h.fase_anterior,
          faseNueva: h.fase_nueva,
        },
        creadoEn: h.creado_en,
      });
    }

    for (const d of docs.rows) {
      eventos.push({
        id: `doc-${d.id}`,
        tipo: 'DOCUMENTO',
        titulo: `Documento cargado: ${d.nombre_archivo}`,
        descripcion: `Clasificación: ${d.tipo_documento}`,
        usuarioNombre: nombreUsuario(d.nombre, d.apellido),
        detalle: { tipoDocumento: d.tipo_documento },
        creadoEn: d.creado_en,
      });
    }

    for (const c of correosOp.rows) {
      const enviado = c.direccion === 'ENVIADO';
      eventos.push({
        id: `co-${c.id}`,
        tipo: enviado ? 'CORREO_ENVIADO' : 'CORREO_RECIBIDO',
        titulo: enviado ? `Correo enviado: ${c.asunto}` : `Correo recibido: ${c.asunto}`,
        descripcion: `${c.remitente} · ${c.origen} · ${c.prioridad}`,
        detalle: { direccion: c.direccion, origen: c.origen },
        creadoEn: c.creado_en,
      });
    }

    for (const e of correosEnviados) {
      if (correosOp.rows.some((c) => c.direccion === 'ENVIADO' && c.asunto === e.asunto)) {
        continue;
      }
      eventos.push({
        id: `ce-${e.id}`,
        tipo: 'CORREO_ENVIADO',
        titulo: `Correo enviado (${e.estado}): ${e.asunto}`,
        descripcion: `Para: ${e.destinatarioEmail}${e.mensajeError ? ` — Error: ${e.mensajeError}` : ''}`,
        detalle: {
          tipo: e.tipo,
          estado: e.estado,
          remitente: e.remitente,
        },
        creadoEn: e.creadoEn,
      });
    }

    for (const a of actividades.rows) {
      eventos.push({
        id: `act-${a.id}`,
        tipo: 'ACTIVIDAD',
        titulo: `Actividad: ${a.titulo}`,
        descripcion: `Estado: ${a.estado}`,
        tipoServicio: a.tipo_servicio,
        detalle: { estado: a.estado },
        creadoEn: a.actualizado_en,
      });
    }

    eventos.sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime());
    return eventos;
  }

  static async listarCorreosEnviados(operacionId: string): Promise<CorreoEnviadoHbi[]> {
    try {
      const r = await query<{
        id: string;
        operacion_id: string | null;
        codigo_operacion: string | null;
        tipo: string;
        estado: string;
        destinatario_email: string;
        remitente: string | null;
        asunto: string;
        cuerpo_texto: string | null;
        mensaje_error: string | null;
        creado_en: string;
      }>(
        `SELECT id, operacion_id, codigo_operacion, tipo, estado, destinatario_email,
                remitente, asunto, cuerpo_texto, mensaje_error, creado_en
         FROM correos_enviados
         WHERE operacion_id = $1
         ORDER BY creado_en DESC`,
        [operacionId]
      );
      return r.rows.map((row) => ({
        id: row.id,
        operacionId: row.operacion_id,
        codigoOperacion: row.codigo_operacion,
        tipo: row.tipo,
        estado: row.estado as 'enviado' | 'fallido',
        destinatarioEmail: row.destinatario_email,
        remitente: row.remitente,
        asunto: row.asunto,
        cuerpoTexto: row.cuerpo_texto,
        mensajeError: row.mensaje_error,
        creadoEn: row.creado_en,
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('operacion_id')) {
        return [];
      }
      throw e;
    }
  }
}

function nombreUsuario(nombre: string | null, apellido: string | null): string | undefined {
  const n = `${nombre ?? ''} ${apellido ?? ''}`.trim();
  return n || undefined;
}

function etiquetaHistorial(tipo: string): string {
  const map: Record<string, string> = {
    CREACION: 'Operación creada',
    CAMBIO_FASE: 'Cambio de fase',
    DOCUMENTO_SUBIDO: 'Documento subido',
    CORREO_REGISTRADO: 'Correo registrado en bandeja',
    CORREO_ENVIADO: 'Correo enviado desde la operación',
    ACTIVIDAD_CREADA: 'Actividad creada',
    ACTIVIDAD_ESTADO: 'Estado de actividad actualizado',
  };
  return map[tipo] ?? tipo;
}
