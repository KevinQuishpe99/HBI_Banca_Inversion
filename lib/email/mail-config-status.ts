/**
 * Estado de configuración de correo (sin exponer secretos).
 */

export type MailConfigStatus = {
  graphTenantConfigured: boolean;
  graphClientIdConfigured: boolean;
  graphClientSecretConfigured: boolean;
  mailFromAddress: string | null;
  appUrl: string | null;
  subjectPrefix: string;
  transport: 'microsoft_graph';
  ready: boolean;
  missing: string[];
};

export function getMailConfigStatus(): MailConfigStatus {
  const tenant = process.env.AZURE_MAIL_TENANT_ID?.trim();
  const clientId = process.env.AZURE_MAIL_CLIENT_ID?.trim();
  const clientSecret = process.env.AZURE_MAIL_CLIENT_SECRET?.trim();
  const from = process.env.MAIL_FROM_ADDRESS?.trim() || null;
  const appUrl =
    (process.env.NEXTAUTH_URL?.trim() || process.env.APP_URL?.trim() || '').replace(/\/$/, '') || null;

  const missing: string[] = [];
  if (!tenant) missing.push('AZURE_MAIL_TENANT_ID');
  if (!clientId) missing.push('AZURE_MAIL_CLIENT_ID');
  if (!clientSecret) missing.push('AZURE_MAIL_CLIENT_SECRET');
  if (!from) missing.push('MAIL_FROM_ADDRESS');

  return {
    graphTenantConfigured: Boolean(tenant),
    graphClientIdConfigured: Boolean(clientId),
    graphClientSecretConfigured: Boolean(clientSecret),
    mailFromAddress: from,
    appUrl,
    subjectPrefix: '[COMWARE] Sistema de Gestión Documental',
    transport: 'microsoft_graph',
    ready: missing.length === 0,
    missing,
  };
}
