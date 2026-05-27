import { query } from '@/lib/db';
import type { EmailLogEstado, EmailLogTipo } from '@/types/email-log';

const MAX_BODY_LOG_CHARS = 12_000;
const MAX_HTML_LOG_CHARS = 80_000;

export type PersistEmailLogParams = {
  tipo: EmailLogTipo;
  estado: EmailLogEstado;
  destinatarioEmail: string;
  destinatarioUsuarioId?: string | null;
  asunto: string;
  cuerpoTexto?: string | null;
  cuerpoHtml?: string | null;
  usaHtml?: boolean;
  tramiteId?: string | null;
  numeroTramite?: string | null;
  operacionId?: string | null;
  codigoOperacion?: string | null;
  mensajeError?: string | null;
  remitente?: string | null;
  envioLoteId?: string | null;
};

function truncateLog(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n… [truncado en auditoría]`;
}

function sanitizeBodyForLog(tipo: EmailLogTipo, body: string): string {
  let text = body;
  if (tipo === 'ACCOUNT_CREDENTIALS') {
    text = text.replace(/Contraseña:\s*.+/gi, 'Contraseña: [oculta en auditoría]');
  }
  return truncateLog(text, MAX_BODY_LOG_CHARS);
}

function sanitizeHtmlForLog(tipo: EmailLogTipo, html: string): string {
  let h = html;
  if (tipo === 'ACCOUNT_CREDENTIALS') {
    h = h.replace(/<strong>Contraseña:<\/strong>\s*[^<]+/gi, '<strong>Contraseña:</strong> [oculta]');
    h = h.replace(/Contraseña:<\/strong>\s*[^<]+/gi, 'Contraseña:</strong> [oculta]');
  }
  return truncateLog(h, MAX_HTML_LOG_CHARS);
}

/**
 * Guarda un registro de envío (éxito o fallo). No lanza si la tabla no existe aún.
 */
export async function persistEmailLog(params: PersistEmailLogParams): Promise<void> {
  const cuerpo =
    params.cuerpoTexto != null && params.cuerpoTexto !== ''
      ? sanitizeBodyForLog(params.tipo, params.cuerpoTexto)
      : null;
  const cuerpoHtml =
    params.cuerpoHtml != null && params.cuerpoHtml !== ''
      ? sanitizeHtmlForLog(params.tipo, params.cuerpoHtml)
      : null;

  try {
    await query(
      `INSERT INTO correos_enviados (
        tipo, estado, destinatario_email, destinatario_usuario_id,
        remitente, asunto, cuerpo_texto, cuerpo_html, usa_html,
        tramite_id, numero_tramite, operacion_id, codigo_operacion,
        mensaje_error, envio_lote_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        params.tipo,
        params.estado,
        params.destinatarioEmail.trim(),
        params.destinatarioUsuarioId ?? null,
        params.remitente ?? null,
        params.asunto.slice(0, 500),
        cuerpo,
        cuerpoHtml,
        Boolean(params.usaHtml || cuerpoHtml),
        params.tramiteId ?? null,
        params.numeroTramite ?? null,
        params.operacionId ?? null,
        params.codigoOperacion ?? null,
        params.mensajeError ?? null,
        params.envioLoteId ?? null,
      ]
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('correos_enviados') && (msg.includes('does not exist') || msg.includes('no existe'))) {
      console.warn('[email-log] Tabla correos_enviados no existe; ejecute npm run db:migrate-correos-enviados');
      return;
    }
    console.error('[email-log] persistEmailLog', e);
  }
}
