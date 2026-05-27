/**
 * Envío de correo con Microsoft Graph (permiso de aplicación Mail.Send).
 * Usa AZURE_MAIL_* y MAIL_FROM_ADDRESS.
 */

import { persistEmailLog } from '@/lib/email/email-log';
import { ValidationError } from '@/lib/utils/errors';
import type { EmailLogTipo } from '@/types/email-log';

type TokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

function requireMailEnv() {
  const tenantId = process.env.AZURE_MAIL_TENANT_ID?.trim();
  const clientId = process.env.AZURE_MAIL_CLIENT_ID?.trim();
  const clientSecret = process.env.AZURE_MAIL_CLIENT_SECRET?.trim();
  const from = process.env.MAIL_FROM_ADDRESS?.trim();
  if (!tenantId || !clientId || !clientSecret) {
    throw new ValidationError(
      'Faltan AZURE_MAIL_TENANT_ID, AZURE_MAIL_CLIENT_ID o AZURE_MAIL_CLIENT_SECRET en el entorno.'
    );
  }
  if (!from) {
    throw new ValidationError('Falta MAIL_FROM_ADDRESS (buzón remitente en Microsoft 365).');
  }
  return { tenantId, clientId, clientSecret, from };
}

export async function getGraphApplicationAccessToken(): Promise<string> {
  const { tenantId, clientId, clientSecret } = requireMailEnv();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    }
  );
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || !json.access_token) {
    const msg = json.error_description || json.error || res.statusText;
    throw new ValidationError(`No se pudo obtener token de Graph: ${msg}`);
  }
  return json.access_token;
}

export type SendMailLogMeta = {
  tipo: EmailLogTipo;
  destinatarioUsuarioId?: string | null;
  tramiteId?: string | null;
  numeroTramite?: string | null;
  operacionId?: string | null;
  codigoOperacion?: string | null;
  envioLoteId?: string | null;
};

export type SendMailParams = {
  to: string;
  subject: string;
  bodyText: string;
  /** Si se envía, Graph usa HTML (plantilla COMWARE); el texto plano sigue siendo útil como respaldo en logs. */
  bodyHtml?: string;
  /** Metadatos para auditoría en `correos_enviados`. */
  logMeta?: SendMailLogMeta;
};

/**
 * Envía correo como MAIL_FROM_ADDRESS (debe existir en el tenant).
 */
export async function sendMailApplication(params: SendMailParams): Promise<void> {
  const { from } = requireMailEnv();
  const logBase = params.logMeta
    ? {
        tipo: params.logMeta.tipo,
        destinatarioEmail: params.to.trim(),
        destinatarioUsuarioId: params.logMeta.destinatarioUsuarioId ?? null,
        remitente: from,
        asunto: params.subject,
        cuerpoTexto: params.bodyText,
        usaHtml: Boolean(params.bodyHtml?.trim()),
        tramiteId: params.logMeta.tramiteId ?? null,
        numeroTramite: params.logMeta.numeroTramite ?? null,
        operacionId: params.logMeta.operacionId ?? null,
        codigoOperacion: params.logMeta.codigoOperacion ?? null,
        cuerpoHtml: params.bodyHtml?.trim() || null,
        envioLoteId: params.logMeta.envioLoteId ?? null,
      }
    : null;

  let token: string;
  try {
    token = await getGraphApplicationAccessToken();
  } catch (e) {
    if (logBase) {
      const msg = e instanceof Error ? e.message : String(e);
      await persistEmailLog({ ...logBase, estado: 'fallido', mensajeError: msg });
    }
    throw e;
  }

  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`;
  const useHtml = Boolean(params.bodyHtml?.trim());
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject: params.subject,
        body: useHtml
          ? {
              contentType: 'HTML',
              content: params.bodyHtml!.trim(),
            }
          : {
              contentType: 'Text',
              content: params.bodyText,
            },
        toRecipients: [
          {
            emailAddress: {
              address: params.to,
            },
          },
        ],
      },
      saveToSentItems: true,
    }),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = (await res.json()) as { error?: { message?: string } };
      if (err.error?.message) detail = err.error.message;
    } catch {
      /* ignore */
    }
    const errMsg = `Graph sendMail falló (${res.status}): ${detail}`;
    if (logBase) {
      await persistEmailLog({ ...logBase, estado: 'fallido', mensajeError: errMsg });
    }
    throw new ValidationError(errMsg);
  }

  if (logBase) {
    await persistEmailLog({ ...logBase, estado: 'enviado' });
  }
}
