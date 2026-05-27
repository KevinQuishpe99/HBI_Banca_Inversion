/**
 * Envío de prueba por Graph (usa .env del proyecto).
 * Uso: node scripts/send-test-mail.mjs destino@correo.com
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const to = process.argv[2];
if (!to || !to.includes('@')) {
  console.error('Uso: node scripts/send-test-mail.mjs destino@correo.com');
  process.exit(1);
}

const tenantId = process.env.AZURE_MAIL_TENANT_ID?.trim();
const clientId = process.env.AZURE_MAIL_CLIENT_ID?.trim();
const clientSecret = process.env.AZURE_MAIL_CLIENT_SECRET?.trim();
const from = process.env.MAIL_FROM_ADDRESS?.trim();

if (!tenantId || !clientId || !clientSecret || !from) {
  console.error('Faltan variables AZURE_MAIL_* o MAIL_FROM_ADDRESS en .env');
  process.exit(1);
}

async function getToken() {
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
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    console.error('Token:', json);
    throw new Error(json.error_description || json.error || 'Sin token');
  }
  return json.access_token;
}

async function sendMail(token) {
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject: '[Prueba] Gestión de archivos',
        body: {
          contentType: 'Text',
          content: `Correo de prueba.\nRemitente: ${from}\nPara: ${to}\n${new Date().toISOString()}`,
        },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || res.statusText);
  }
}

try {
  const token = await getToken();
  await sendMail(token);
  console.log('OK: correo enviado a', to);
} catch (e) {
  console.error('Error:', e.message || e);
  process.exit(1);
}
