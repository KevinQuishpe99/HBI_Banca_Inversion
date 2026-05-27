import { query } from '@/lib/db';
import { sendMailApplication, type SendMailLogMeta } from '@/lib/email/graph-mail';
import { getEmailTemplateTheme } from '@/lib/email/template-cache';
import {
  buildCredentialsEmailHtml,
  buildNotificationHtmlFromPlainBody,
} from '@/lib/email/transactional-html';
import { ValidationError } from '@/lib/utils/errors';

/** Asunto y pie: identidad institucional para correos transaccionales (producción). */
const EMAIL_SUBJECT_PREFIX = '[COMWARE] Sistema de Gestión Documental';

function subjectLine(specific: string): string {
  return `${EMAIL_SUBJECT_PREFIX} — ${specific}`;
}

function emailFooter(): string {
  return [
    '',
    '────────────────────────────────────────',
    'Este mensaje se ha generado de forma automática por el Sistema de Gestión Documental de COMWARE.',
    'No responda a este correo. Ante consultas, contacte a su administrador interno.',
  ].join('\n');
}

function appBaseUrl(): string {
  const u = process.env.NEXTAUTH_URL?.trim() || process.env.APP_URL?.trim() || '';
  return u.replace(/\/$/, '');
}

async function safeSend(
  to: string | undefined | null,
  subject: string,
  bodyText: string,
  bodyHtml: string | undefined,
  logMeta: SendMailLogMeta
): Promise<void> {
  if (!to?.trim()) return;
  try {
    const theme = await getEmailTemplateTheme();
    const html = bodyHtml ?? buildNotificationHtmlFromPlainBody(bodyText, theme);
    await sendMailApplication({ to: to.trim(), subject, bodyText, bodyHtml: html, logMeta });
  } catch (e) {
    if (e instanceof ValidationError) {
      console.warn('[notification-email]', e.message);
      return;
    }
    console.error('[notification-email] envío fallido', e);
  }
}

export async function getUserEmailAndName(
  userId: string
): Promise<{ email: string; name: string } | null> {
  const r = await query<{ email: string; nombre: string | null; apellido: string | null }>(
    `SELECT email, nombre, apellido FROM usuarios WHERE id = $1`,
    [userId]
  );
  const row = r.rows[0];
  if (!row) return null;
  const name = `${row.nombre ?? ''} ${row.apellido ?? ''}`.trim() || row.email;
  return { email: row.email, name };
}

export async function getCaseFileNames(caseId: string): Promise<string[]> {
  const r = await query<{ nombre_archivo: string }>(
    `SELECT nombre_archivo
     FROM archivos
     WHERE tramite_id = $1 AND eliminado = false
     ORDER BY subido_en ASC NULLS LAST`,
    [caseId]
  );
  return r.rows.map((x) => x.nombre_archivo);
}

export async function sendAccountCredentialsEmail(
  to: string,
  displayName: string,
  plainPassword: string,
  kind: 'registration' | 'admin_created'
): Promise<void> {
  const base = appBaseUrl();
  const emailTrim = to.trim();
  const intro =
    kind === 'admin_created'
      ? 'Un administrador ha registrado su usuario en el Sistema de Gestión Documental de COMWARE.'
      : 'Le confirmamos el alta de su cuenta en el Sistema de Gestión Documental de COMWARE.';
  const subj =
    kind === 'admin_created'
      ? subjectLine('Usuario creado — credenciales de acceso')
      : subjectLine('Registro completado — credenciales de acceso');
  const lines = [
    `Estimado/a ${displayName},`,
    '',
    intro,
    '',
    'Datos de acceso al sistema de gestión documental y expedientes:',
    `Correo electrónico (usuario): ${emailTrim}`,
    `Contraseña: ${plainPassword}`,
    '',
    'Conserve esta información de forma confidencial. Por seguridad, modifique la contraseña tras el primer inicio de sesión si la aplicación lo permite.',
    base ? `Enlace de acceso: ${base}/login` : '',
    '',
    kind === 'admin_created'
      ? 'Si no esperaba este alta, contacte de inmediato a su administrador.'
      : 'Si no solicitó este registro, ignore este mensaje y notifíquelo a su administrador.',
    emailFooter(),
  ].filter(Boolean);
  const bodyText = lines.join('\n');
  const loginUrl = base ? `${base}/login` : '';
  const theme = await getEmailTemplateTheme();
  const bodyHtml = buildCredentialsEmailHtml({
    displayName,
    email: emailTrim,
    plainPassword,
    loginUrl,
    kind,
    theme,
  });
  await safeSend(emailTrim, subj, bodyText, bodyHtml, {
    tipo: 'ACCOUNT_CREDENTIALS',
  });
}

function formatFileList(names: string[]): string {
  if (names.length === 0) return '(sin archivos adjuntos en el expediente)';
  return names.map((n, i) => `  ${i + 1}. ${n}`).join('\n');
}

export async function mailCaseReturned(params: {
  creatorId: string;
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  areaName: string;
  reasonShort: string;
  fullDetail: string;
  returnedByUserId: string;
}): Promise<void> {
  const creator = await getUserEmailAndName(params.creatorId);
  if (!creator) return;
  const actor = await getUserEmailAndName(params.returnedByUserId);
  const files = await getCaseFileNames(params.caseId);
  const base = appBaseUrl();
  const body = [
    `Estimado/a ${creator.name},`,
    '',
    `Se ha devuelto el trámite ${params.caseNumber} — «${params.caseTitle}» para correcciones.`,
    '',
    'Resumen',
    `  • Número: ${params.caseNumber}`,
    `  • Título: ${params.caseTitle}`,
    `  • Área que devolvió: ${params.areaName}`,
    `  • Usuario que devolvió: ${actor?.name ?? '—'}`,
    `  • Motivo (breve): ${params.reasonShort}`,
    '',
    'Detalle / comentarios al solicitante:',
    params.fullDetail.trim() || '—',
    '',
    'Archivos actuales en el expediente:',
    formatFileList(files),
    base ? `\nConsultar trámite: ${base}/cases/${params.caseId}` : '',
    emailFooter(),
  ].join('\n');

  await safeSend(
    creator.email,
    subjectLine(`Trámite ${params.caseNumber} devuelto — ${params.areaName}`),
    body,
    buildNotificationHtmlFromPlainBody(body),
    {
      tipo: 'CASE_RETURNED',
      destinatarioUsuarioId: params.creatorId,
      tramiteId: params.caseId,
      numeroTramite: params.caseNumber,
    }
  );
}

export async function mailCaseApproved(params: {
  creatorId: string;
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  areaName: string;
  approvedByUserId: string;
  comments?: string | null;
}): Promise<void> {
  const creator = await getUserEmailAndName(params.creatorId);
  if (!creator) return;
  const actor = await getUserEmailAndName(params.approvedByUserId);
  const files = await getCaseFileNames(params.caseId);
  const base = appBaseUrl();
  const body = [
    `Estimado/a ${creator.name},`,
    '',
    `El área ${params.areaName} ha registrado la revisión del trámite ${params.caseNumber} — «${params.caseTitle}».`,
    '',
    'Detalle',
    `  • Área: ${params.areaName}`,
    `  • Revisado por: ${actor?.name ?? '—'}`,
    `  • Comentarios del revisor: ${(params.comments ?? '').trim() || '—'}`,
    '',
    'Archivos en el expediente:',
    formatFileList(files),
    base ? `\nConsultar trámite: ${base}/cases/${params.caseId}` : '',
    emailFooter(),
  ].join('\n');

  await safeSend(
    creator.email,
    subjectLine(`Trámite ${params.caseNumber} revisado — ${params.areaName}`),
    body,
    buildNotificationHtmlFromPlainBody(body),
    {
      tipo: 'CASE_APPROVED',
      destinatarioUsuarioId: params.creatorId,
      tramiteId: params.caseId,
      numeroTramite: params.caseNumber,
    }
  );
}

export async function mailCaseCompleted(params: {
  creatorId: string;
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  variant: 'workflow' | 'legal_early';
  completedByUserId?: string;
}): Promise<void> {
  const creator = await getUserEmailAndName(params.creatorId);
  if (!creator) return;
  const actor = params.completedByUserId ? await getUserEmailAndName(params.completedByUserId) : null;
  const files = await getCaseFileNames(params.caseId);
  const base = appBaseUrl();
  const intro =
    params.variant === 'legal_early'
      ? `El área Legal ha dado por completado el trámite ${params.caseNumber} — «${params.caseTitle}».`
      : `El trámite ${params.caseNumber} — «${params.caseTitle}» ha concluido el flujo de revisión y se encuentra completado.`;

  const body = [
    `Estimado/a ${creator.name},`,
    '',
    intro,
    '',
    'Detalle',
    params.variant === 'legal_early'
      ? `  • Cerrado por área: Legal\n  • Usuario (Legal): ${actor?.name ?? '—'}`
      : '  • Estado: trámite completado según el flujo definido',
    '',
    'Archivos en el expediente:',
    formatFileList(files),
    base ? `\nConsultar trámite: ${base}/cases/${params.caseId}` : '',
    emailFooter(),
  ].join('\n');

  const subj =
    params.variant === 'legal_early'
      ? subjectLine(`Trámite ${params.caseNumber} completado (cierre Legal)`)
      : subjectLine(`Trámite ${params.caseNumber} completado`);

  await safeSend(creator.email, subj, body, buildNotificationHtmlFromPlainBody(body), {
    tipo: 'CASE_COMPLETED',
    destinatarioUsuarioId: params.creatorId,
    tramiteId: params.caseId,
    numeroTramite: params.caseNumber,
  });
}

export async function mailAreaNewCase(params: {
  userId: string;
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  areaLabel: string;
  creatorName: string;
}): Promise<void> {
  const u = await getUserEmailAndName(params.userId);
  if (!u) return;
  const files = await getCaseFileNames(params.caseId);
  const base = appBaseUrl();
  const body = [
    `Estimado/a ${u.name},`,
    '',
    `Tiene un trámite asignado al área ${params.areaLabel} pendiente de revisión.`,
    '',
    'Datos del trámite',
    `  • Número: ${params.caseNumber}`,
    `  • Título: ${params.caseTitle}`,
    `  • Solicitante: ${params.creatorName}`,
    `  • Área asignada: ${params.areaLabel}`,
    '',
    'Archivos en el expediente:',
    formatFileList(files),
    base ? `\nBandeja de revisión: ${base}/review` : '',
    base ? `Detalle del trámite: ${base}/cases/${params.caseId}` : '',
    emailFooter(),
  ].join('\n');

  await safeSend(
    u.email,
    subjectLine(`Nuevo trámite ${params.caseNumber} — ${params.areaLabel}`),
    body,
    buildNotificationHtmlFromPlainBody(body),
    {
      tipo: 'CASE_AREA_NEW',
      destinatarioUsuarioId: params.userId,
      tramiteId: params.caseId,
      numeroTramite: params.caseNumber,
    }
  );
}

export async function mailAreaResubmitted(params: {
  userId: string;
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  areaLabel: string;
  creatorName: string;
}): Promise<void> {
  const u = await getUserEmailAndName(params.userId);
  if (!u) return;
  const files = await getCaseFileNames(params.caseId);
  const base = appBaseUrl();
  const body = [
    `Estimado/a ${u.name},`,
    '',
    `${params.creatorName} ha reenviado el trámite ${params.caseNumber} — «${params.caseTitle}» con las correcciones solicitadas.`,
    '',
    'Datos',
    `  • Número: ${params.caseNumber}`,
    `  • Título: ${params.caseTitle}`,
    `  • Área de revisión: ${params.areaLabel}`,
    `  • Solicitante: ${params.creatorName}`,
    '',
    'Archivos en el expediente:',
    formatFileList(files),
    base ? `\nBandeja de revisión: ${base}/review` : '',
    base ? `Detalle del trámite: ${base}/cases/${params.caseId}` : '',
    emailFooter(),
  ].join('\n');

  await safeSend(
    u.email,
    subjectLine(`Trámite ${params.caseNumber} reenviado — ${params.areaLabel}`),
    body,
    buildNotificationHtmlFromPlainBody(body),
    {
      tipo: 'CASE_RESUBMITTED',
      destinatarioUsuarioId: params.userId,
      tramiteId: params.caseId,
      numeroTramite: params.caseNumber,
    }
  );
}

/** Alerta de plazo: recordatorio, urgente o vencido. */
export async function mailDeadlineAlert(params: {
  userId: string;
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  tier: 'REMINDER' | 'URGENT' | 'OVERDUE';
  daysRemaining: number;
}): Promise<void> {
  const u = await getUserEmailAndName(params.userId);
  if (!u) return;
  const base = appBaseUrl();

  const tierLabels: Record<string, string> = {
    REMINDER: 'Recordatorio de plazo',
    URGENT: 'Trámite urgente — fecha límite inminente',
    OVERDUE: 'Trámite vencido — requiere atención inmediata',
  };

  const tierIntro: Record<string, string> = {
    REMINDER: `Le informamos que faltan ${params.daysRemaining} día${params.daysRemaining !== 1 ? 's' : ''} para que venza la fecha límite del siguiente trámite, el cual aún se encuentra pendiente de revisión.`,
    URGENT: params.daysRemaining === 0
      ? `Hoy es la fecha límite del siguiente trámite y aún se encuentra pendiente de revisión. Requiere atención inmediata.`
      : `Mañana vence la fecha límite del siguiente trámite y aún se encuentra pendiente de revisión.`,
    OVERDUE: `La fecha límite del siguiente trámite ya venció (hace ${Math.abs(params.daysRemaining)} día${Math.abs(params.daysRemaining) !== 1 ? 's' : ''}) y aún no está completado. Requiere atención inmediata.`,
  };

  const body = [
    `Estimado/a ${u.name},`,
    '',
    tierIntro[params.tier],
    '',
    'Datos del trámite',
    `  • Número: ${params.caseNumber}`,
    `  • Título: ${params.caseTitle}`,
    '',
    base ? `Bandeja de revisión: ${base}/review` : '',
    base ? `Detalle del trámite: ${base}/cases/${params.caseId}` : '',
    emailFooter(),
  ].join('\n');

  await safeSend(
    u.email,
    subjectLine(`${tierLabels[params.tier]} — trámite ${params.caseNumber}`),
    body,
    buildNotificationHtmlFromPlainBody(body),
    {
      tipo: 'DEADLINE_ALERT',
      destinatarioUsuarioId: params.userId,
      tramiteId: params.caseId,
      numeroTramite: params.caseNumber,
    }
  );
}

/** Alerta a Comercial, Legal y Director General por monto ≥ umbral. */
export async function mailHighAmountCaseAlert(params: {
  userId: string;
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  areaLabel: string;
  creatorName: string;
  amount: number;
  threshold: number;
}): Promise<void> {
  const u = await getUserEmailAndName(params.userId);
  if (!u) return;
  const files = await getCaseFileNames(params.caseId);
  const base = appBaseUrl();
  const fmt = (n: number) =>
    n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const body = [
    `Estimado/a ${u.name},`,
    '',
    `Se registró un trámite cuyo monto declarado es igual o superior al umbral de alerta configurado en el sistema.`,
    '',
    'Datos del trámite',
    `  • Número: ${params.caseNumber}`,
    `  • Título: ${params.caseTitle}`,
    `  • Solicitante: ${params.creatorName}`,
    `  • Monto declarado: USD ${fmt(params.amount)}`,
    `  • Umbral de alerta: USD ${fmt(params.threshold)}`,
    `  • Destinatario por área: ${params.areaLabel}`,
    '',
    'Archivos en el expediente:',
    formatFileList(files),
    base ? `\nBandeja de revisión: ${base}/review` : '',
    base ? `Detalle del trámite: ${base}/cases/${params.caseId}` : '',
    emailFooter(),
  ].join('\n');

  await safeSend(
    u.email,
    subjectLine(`Alerta de monto — trámite ${params.caseNumber} (${params.areaLabel})`),
    body,
    buildNotificationHtmlFromPlainBody(body),
    {
      tipo: 'CASE_HIGH_AMOUNT',
      destinatarioUsuarioId: params.userId,
      tramiteId: params.caseId,
      numeroTramite: params.caseNumber,
    }
  );
}
