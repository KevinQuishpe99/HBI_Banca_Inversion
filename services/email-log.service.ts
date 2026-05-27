import { query } from '@/lib/db';
import { ValidationError } from '@/lib/utils/errors';
import type { EmailLogListResult, EmailLogRecord, EmailLogTipo } from '@/types/email-log';

const TIPOS_VALIDOS: EmailLogTipo[] = [
  'CASE_RETURNED',
  'CASE_APPROVED',
  'CASE_COMPLETED',
  'CASE_AREA_NEW',
  'CASE_RESUBMITTED',
  'DEADLINE_ALERT',
  'CASE_HIGH_AMOUNT',
  'ACCOUNT_CREDENTIALS',
  'TEST_MAIL',
  'ADMIN_COMUNICADO',
  'HBI_OPERACION',
  'HBI_NOTIFICACION',
  'HBI_COMUNICADO',
];

export type ListEmailLogsParams = {
  page?: number;
  pageSize?: number;
  tipo?: EmailLogTipo | null;
  q?: string | null;
  tramiteId?: string | null;
  operacionId?: string | null;
};

type PgErr = Error & { code?: string };

function isMissingColumnError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const code = (e as PgErr).code;
  return (
    (code === '42703' || msg.includes('does not exist') || msg.includes('no existe')) &&
    (msg.includes('cuerpo_html') || msg.includes('envio_lote_id'))
  );
}

function isMissingTableError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const code = (e as PgErr).code;
  return (
    code === '42P01' ||
    ((msg.includes('does not exist') || msg.includes('no existe')) && msg.includes('correos_enviados'))
  );
}

function mapRow(row: Record<string, unknown>): EmailLogRecord {
  return {
    id: String(row.id ?? ''),
    tipo: String(row.tipo ?? '') as EmailLogTipo,
    estado: String(row.estado ?? 'enviado') as EmailLogRecord['estado'],
    destinatarioEmail: String(row.destinatario_email ?? ''),
    destinatarioUsuarioId: row.destinatario_usuario_id != null ? String(row.destinatario_usuario_id) : null,
    destinatarioNombre:
      row.destinatario_nombre != null
        ? `${String(row.destinatario_nombre ?? '')} ${String(row.destinatario_apellido ?? '')}`.trim() || null
        : null,
    remitente: row.remitente != null ? String(row.remitente) : null,
    asunto: String(row.asunto ?? ''),
    cuerpoTexto: row.cuerpo_texto != null ? String(row.cuerpo_texto) : null,
    cuerpoHtml:
      row.cuerpo_html != null && String(row.cuerpo_html).length > 0
        ? String(row.cuerpo_html)
        : null,
    usaHtml: Boolean(row.usa_html),
    envioLoteId: row.envio_lote_id != null ? String(row.envio_lote_id) : null,
    tramiteId: row.tramite_id != null ? String(row.tramite_id) : null,
    numeroTramite: row.numero_tramite != null ? String(row.numero_tramite) : null,
    operacionId: row.operacion_id != null ? String(row.operacion_id) : null,
    codigoOperacion: row.codigo_operacion != null ? String(row.codigo_operacion) : null,
    tieneVistaHtml:
      row.tiene_vista_html != null
        ? Boolean(row.tiene_vista_html)
        : row.cuerpo_html != null && String(row.cuerpo_html).length > 0,
    mensajeError: row.mensaje_error != null ? String(row.mensaje_error) : null,
    creadoEn: row.creado_en instanceof Date ? row.creado_en.toISOString() : String(row.creado_en ?? ''),
  };
}

function buildWhere(params: ListEmailLogsParams): { where: string; values: unknown[] } {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (params.tipo && TIPOS_VALIDOS.includes(params.tipo)) {
    conditions.push(`c.tipo = $${idx++}`);
    values.push(params.tipo);
  }

  if (params.tramiteId?.trim()) {
    conditions.push(`c.tramite_id = $${idx++}::uuid`);
    values.push(params.tramiteId.trim());
  }

  if (params.operacionId?.trim()) {
    conditions.push(`c.operacion_id = $${idx++}::uuid`);
    values.push(params.operacionId.trim());
  }

  const q = params.q?.trim();
  if (q) {
    conditions.push(
      `(c.destinatario_email ILIKE $${idx} OR c.asunto ILIKE $${idx} OR c.numero_tramite ILIKE $${idx})`
    );
    values.push(`%${q}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, values };
}

export class EmailLogService {
  static async list(params: ListEmailLogsParams): Promise<EmailLogListResult> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(10, params.pageSize ?? 25));
    const offset = (page - 1) * pageSize;
    const { where, values } = buildWhere(params);

    try {
      return await EmailLogService.listWithSchema(params, page, pageSize, offset, where, values, true);
    } catch (e) {
      if (isMissingColumnError(e)) {
        try {
          return await EmailLogService.listWithSchema(
            params,
            page,
            pageSize,
            offset,
            where,
            values,
            false
          );
        } catch (e2) {
          if (isMissingTableError(e2)) {
            throw new ValidationError(
              'El historial de correos no está activo en la base de datos. Solicite al administrador del sistema que ejecute la migración de correos.'
            );
          }
          throw e2;
        }
      }
      if (isMissingTableError(e)) {
        throw new ValidationError(
          'El historial de correos no está activo en la base de datos. Solicite al administrador del sistema que ejecute la migración de correos.'
        );
      }
      throw e;
    }
  }

  private static async listWithSchema(
    params: ListEmailLogsParams,
    page: number,
    pageSize: number,
    offset: number,
    where: string,
    values: unknown[],
    extended: boolean
  ): Promise<EmailLogListResult> {
    let idx = values.length + 1;

    const countRes = await query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM correos_enviados c ${where}`,
      values
    );
    const total = parseInt(countRes.rows[0]?.total ?? '0', 10);

    const extraCols = extended
      ? `c.envio_lote_id,
         (c.cuerpo_html IS NOT NULL AND LENGTH(c.cuerpo_html) > 0) AS tiene_vista_html,`
      : `NULL::uuid AS envio_lote_id,
         false AS tiene_vista_html,`;

    const listRes = await query<Record<string, unknown>>(
      `SELECT c.id, c.tipo, c.estado, c.destinatario_email, c.destinatario_usuario_id,
              c.remitente, c.asunto, c.cuerpo_texto, c.usa_html, c.tramite_id, c.numero_tramite,
              c.mensaje_error, c.creado_en,
              ${extraCols}
              u.nombre AS destinatario_nombre,
              u.apellido AS destinatario_apellido
       FROM correos_enviados c
       LEFT JOIN usuarios u ON u.id = c.destinatario_usuario_id
       ${where}
       ORDER BY c.creado_en DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, pageSize, offset]
    );

    return {
      items: listRes.rows.map(mapRow),
      total,
      page,
      pageSize,
    };
  }

  static async getById(id: string): Promise<EmailLogRecord | null> {
    try {
      const res = await query<Record<string, unknown>>(
        `SELECT c.*,
                u.nombre AS destinatario_nombre,
                u.apellido AS destinatario_apellido
         FROM correos_enviados c
         LEFT JOIN usuarios u ON u.id = c.destinatario_usuario_id
         WHERE c.id = $1::uuid`,
        [id]
      );
      const row = res.rows[0];
      return row ? mapRow(row) : null;
    } catch (e) {
      if (!isMissingColumnError(e)) throw e;
      const res = await query<Record<string, unknown>>(
        `SELECT c.id, c.tipo, c.estado, c.destinatario_email, c.destinatario_usuario_id,
                c.remitente, c.asunto, c.cuerpo_texto, c.usa_html, c.tramite_id, c.numero_tramite,
                c.mensaje_error, c.creado_en,
                u.nombre AS destinatario_nombre,
                u.apellido AS destinatario_apellido
         FROM correos_enviados c
         LEFT JOIN usuarios u ON u.id = c.destinatario_usuario_id
         WHERE c.id = $1::uuid`,
        [id]
      );
      const row = res.rows[0];
      return row ? mapRow(row) : null;
    }
  }
}
