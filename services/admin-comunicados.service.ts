import { randomUUID } from 'crypto';
import { query } from '@/lib/db';
import { sendMailApplication } from '@/lib/email/graph-mail';
import { getEmailTemplateTheme } from '@/lib/email/template-cache';
import { buildNotificationHtmlFromPlainBody } from '@/lib/email/transactional-html';
import { ValidationError } from '@/lib/utils/errors';

const SUBJECT_PREFIX = '[COMWARE] Sistema de Gestión Documental';

type Recipient = {
  id: string;
  email: string;
  name: string;
};

function buildComunicadoBody(displayName: string, message: string): string {
  const lines = [
    `Estimado/a ${displayName},`,
    '',
    message.trim(),
    '',
    '────────────────────────────────────────',
    'Este mensaje fue enviado por la administración del Sistema de Gestión Documental de COMWARE.',
    'No responda a este correo. Ante consultas, contacte a su administrador interno.',
  ];
  return lines.join('\n');
}

function subjectLine(specific: string): string {
  return `${SUBJECT_PREFIX} — ${specific.trim()}`;
}

async function listRecipients(params: {
  audience: 'all' | 'selected';
  userIds?: string[];
}): Promise<Recipient[]> {
  if (params.audience === 'all') {
    const r = await query<{ id: string; email: string; nombre: string | null; apellido: string | null }>(
      `SELECT id, email, nombre, apellido
       FROM usuarios
       WHERE activo = true AND email IS NOT NULL AND TRIM(email) <> ''
       ORDER BY email ASC`
    );
    if (r.rows.length === 0) {
      throw new ValidationError('No hay usuarios activos con correo para enviar el comunicado.');
    }
    return r.rows.map((row) => ({
      id: String(row.id),
      email: row.email.trim(),
      name: `${row.nombre ?? ''} ${row.apellido ?? ''}`.trim() || row.email,
    }));
  }

  const ids = (params.userIds ?? []).map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) {
    throw new ValidationError('Seleccione al menos un usuario destinatario.');
  }

  const r = await query<{ id: string; email: string; nombre: string | null; apellido: string | null }>(
    `SELECT id, email, nombre, apellido
     FROM usuarios
     WHERE activo = true AND id = ANY($1::uuid[])`,
    [ids]
  );

  if (r.rows.length === 0) {
    throw new ValidationError('Ninguno de los usuarios seleccionados está activo o existe.');
  }

  const found = r.rows.map((row) => ({
    id: String(row.id),
    email: row.email.trim(),
    name: `${row.nombre ?? ''} ${row.apellido ?? ''}`.trim() || row.email,
  }));

  if (found.length < ids.length) {
    throw new ValidationError(
      `Solo ${found.length} de ${ids.length} usuario(s) seleccionado(s) están activos. Revise la selección.`
    );
  }

  return found;
}

export type SendComunicadoResult = {
  total: number;
  sent: number;
  failed: number;
  failures: { email: string; error: string }[];
  loteId: string;
};

export async function sendAdminComunicado(params: {
  audience: 'all' | 'selected';
  userIds?: string[];
  subject: string;
  message: string;
}): Promise<SendComunicadoResult> {
  const recipients = await listRecipients({
    audience: params.audience,
    userIds: params.userIds,
  });
  const asunto = subjectLine(params.subject);
  const theme = await getEmailTemplateTheme();
  const loteId = randomUUID();
  const failures: { email: string; error: string }[] = [];
  let sent = 0;

  for (const recipient of recipients) {
    const bodyText = buildComunicadoBody(recipient.name, params.message);
    const bodyHtml = buildNotificationHtmlFromPlainBody(bodyText, theme);
    try {
      await sendMailApplication({
        to: recipient.email,
        subject: asunto,
        bodyText,
        bodyHtml,
        logMeta: {
          tipo: 'ADMIN_COMUNICADO',
          destinatarioUsuarioId: recipient.id,
          envioLoteId: loteId,
        },
      });
      sent++;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      failures.push({ email: recipient.email, error: errMsg });
    }
  }

  if (sent === 0 && failures.length > 0) {
    throw new ValidationError(
      `No se pudo enviar el comunicado. ${failures[0]?.error ?? 'Revise la configuración de correo.'}`
    );
  }

  return {
    total: recipients.length,
    sent,
    failed: failures.length,
    failures,
    loteId,
  };
}
