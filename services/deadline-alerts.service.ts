import { query } from '@/lib/db';
import { getDeadlineAlertConfig } from './app-settings.service';
import { NotificationService } from './notification.service';
import { mailDeadlineAlert } from '@/lib/email/notification-emails';
import type { NotificationType } from '@/types/notification.types';
type AlertTier = 'REMINDER' | 'URGENT' | 'OVERDUE';

function diffCalendarDays(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcA - utcB) / msPerDay);
}

function tierToNotificationType(tier: AlertTier): NotificationType {
  switch (tier) {
    case 'REMINDER': return 'CASE_DEADLINE_REMINDER';
    case 'URGENT': return 'CASE_DEADLINE_URGENT';
    case 'OVERDUE': return 'CASE_DEADLINE_OVERDUE';
  }
}

interface CaseRow {
  id: string;
  numero_tramite: string;
  titulo: string;
  fecha_entrega_requerida: Date;
  tipo_flujo: string | null;
  supervision_completada: boolean | null;
  area_supervision_id: number | null;
  creado_por: string;
}

async function getUserIdsForAreaId(areaId: number): Promise<string[]> {
  const sup = await query<{ supervisor_id: string | null }>(
    `SELECT supervisor_id FROM configuracion_areas WHERE id = $1 LIMIT 1`,
    [areaId]
  );
  const supervisorId = sup.rows[0]?.supervisor_id ?? null;
  const usersResult = await query<{ id: string }>(
    supervisorId
      ? 'SELECT id FROM usuarios WHERE id = $1 AND activo = true'
      : 'SELECT id FROM usuarios WHERE rol = $1 AND area_id = $2 AND activo = true',
    supervisorId ? [supervisorId] : ['AREA_USER', areaId]
  );
  return usersResult.rows.map((r) => r.id);
}

async function getPendingReviewerUserIds(c: CaseRow): Promise<string[]> {
  const flow = c.tipo_flujo ?? 'DIRECT_LEGAL';

  const approvedRes = await query<{ area_id: number }>(
    `SELECT area_id FROM tramite_areas_aprobadas WHERE tramite_id = $1`,
    [c.id]
  );
  const approved = approvedRes.rows.map((r) => r.area_id);

  const reviewRes = await query<{ area_id: number }>(
    `SELECT area_id FROM tramite_areas_revision WHERE tramite_id = $1`,
    [c.id]
  );
  const reviewAreas = reviewRes.rows.map((r) => r.area_id);

  if (flow === 'SUPERVISION_CHAIN' && !c.supervision_completada) {
    const supAreaId = c.area_supervision_id;
    if (!supAreaId) return [];
    return getUserIdsForAreaId(supAreaId);
  }

  const mandatoryR = await query<{ area_id: number }>(
    `SELECT id AS area_id FROM configuracion_areas WHERE obligatorio = true AND activo = true`
  );
  const need = new Set<number>([...reviewAreas, ...mandatoryR.rows.map((r) => r.area_id)]);

  const pending: number[] = [];
  for (const areaId of need) {
    if (!approved.includes(areaId)) pending.push(areaId);
  }

  if (pending.length === 0) return [];

  const userIds: string[] = [];
  for (const areaId of pending) {
    const ids = await getUserIdsForAreaId(areaId);
    userIds.push(...ids);
  }
  return [...new Set(userIds)];
}

async function hasAlertBeenSent(caseId: string, tier: AlertTier): Promise<boolean> {
  const r = await query<{ id: string }>(
    `SELECT id FROM alertas_plazo_tramite WHERE tramite_id = $1 AND nivel_alerta = $2`,
    [caseId, tier]
  );
  return r.rows.length > 0;
}

async function getLastOverdueAlert(caseId: string): Promise<Date | null> {
  const r = await query<{ enviado_en: Date }>(
    `SELECT enviado_en FROM alertas_plazo_tramite WHERE tramite_id = $1 AND nivel_alerta = 'OVERDUE' ORDER BY enviado_en DESC LIMIT 1`,
    [caseId]
  );
  return r.rows[0]?.enviado_en ?? null;
}

async function markAlertSent(caseId: string, tier: AlertTier): Promise<void> {
  if (tier === 'OVERDUE') {
    await query(
      `INSERT INTO alertas_plazo_tramite (tramite_id, nivel_alerta, enviado_en)
       VALUES ($1, $2, NOW())
       ON CONFLICT (tramite_id, nivel_alerta) DO UPDATE SET enviado_en = NOW()`,
      [caseId, tier]
    );
  } else {
    await query(
      `INSERT INTO alertas_plazo_tramite (tramite_id, nivel_alerta) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [caseId, tier]
    );
  }
}

function buildAlertMessage(tier: AlertTier, caseNumber: string, caseTitle: string, daysRemaining: number): { title: string; message: string } {
  switch (tier) {
    case 'REMINDER':
      return {
        title: `Recordatorio — trámite ${caseNumber}`,
        message: `Faltan ${daysRemaining} día${daysRemaining !== 1 ? 's' : ''} para la fecha límite del trámite «${caseTitle}» (${caseNumber}). Por favor revíselo a la brevedad.`,
      };
    case 'URGENT':
      return {
        title: `Urgente — trámite ${caseNumber}`,
        message: daysRemaining === 0
          ? `Hoy vence la fecha límite del trámite «${caseTitle}» (${caseNumber}). Requiere revisión inmediata.`
          : `Mañana vence la fecha límite del trámite «${caseTitle}» (${caseNumber}). Revisión urgente requerida.`,
      };
    case 'OVERDUE':
      return {
        title: `Vencido — trámite ${caseNumber}`,
        message: `La fecha límite del trámite «${caseTitle}» (${caseNumber}) venció hace ${Math.abs(daysRemaining)} día${Math.abs(daysRemaining) !== 1 ? 's' : ''} y aún no está completado. Requiere atención inmediata.`,
      };
  }
}

/**
 * Evalúa y dispara alertas de plazo para un trámite específico.
 */
export async function evaluateDeadlineAlertsForCase(caseId: string): Promise<void> {
  const config = await getDeadlineAlertConfig();
  if (config.reminderDays === 0 && !config.overdueEnabled) return;

  const r = await query<CaseRow>(
    `SELECT t.id, t.numero_tramite, t.titulo, t.fecha_entrega_requerida,
            t.tipo_flujo, t.supervision_completada, t.area_supervision_id,
            t.creado_por
     FROM tramites t
     WHERE t.id = $1
       AND t.estado_id <> 5
       AND t.fecha_entrega_requerida IS NOT NULL`,
    [caseId]
  );
  const row = r.rows[0];
  if (!row) return;

  await processCase(row, config);
}

/**
 * Evalúa todos los trámites abiertos con fecha límite. Para uso en cron job.
 */
export async function evaluateAllDeadlineAlerts(): Promise<{ processed: number; alerts: number }> {
  const config = await getDeadlineAlertConfig();
  if (config.reminderDays === 0 && !config.overdueEnabled) return { processed: 0, alerts: 0 };

  const windowDays = Math.max(config.reminderDays, 0);

  const rows = await query<CaseRow>(
    `SELECT t.id, t.numero_tramite, t.titulo, t.fecha_entrega_requerida,
            t.tipo_flujo, t.supervision_completada, t.area_supervision_id,
            t.creado_por
     FROM tramites t
     WHERE t.estado_id <> 5
       AND t.fecha_entrega_requerida IS NOT NULL
       AND t.fecha_entrega_requerida <= (CURRENT_DATE + INTERVAL '1 day' * $1)
     ORDER BY t.fecha_entrega_requerida ASC`,
    [windowDays]
  );

  let alerts = 0;
  for (const row of rows.rows) {
    const sent = await processCase(row, config);
    alerts += sent;
  }
  return { processed: rows.rows.length, alerts };
}

async function processCase(
  c: CaseRow,
  config: { reminderDays: number; overdueEnabled: boolean; overdueRepeatDays: number }
): Promise<number> {
  const now = new Date();
  const daysRemaining = diffCalendarDays(c.fecha_entrega_requerida, now);
  let sent = 0;

  if (daysRemaining > 0 && daysRemaining <= config.reminderDays) {
    const tier: AlertTier = daysRemaining <= 1 ? 'URGENT' : 'REMINDER';
    const already = await hasAlertBeenSent(c.id, tier);
    if (!already) {
      await sendAlertToReviewers(c, tier, daysRemaining);
      await markAlertSent(c.id, tier);
      sent++;
    }
  } else if (daysRemaining === 0) {
    const already = await hasAlertBeenSent(c.id, 'URGENT');
    if (!already) {
      await sendAlertToReviewers(c, 'URGENT', 0);
      await markAlertSent(c.id, 'URGENT');
      sent++;
    }
  }

  if (daysRemaining <= 0 && config.overdueEnabled) {
    const lastSent = await getLastOverdueAlert(c.id);
    const shouldSend = !lastSent || diffCalendarDays(now, lastSent) >= config.overdueRepeatDays;
    if (shouldSend) {
      await sendAlertToReviewers(c, 'OVERDUE', daysRemaining);
      await markAlertSent(c.id, 'OVERDUE');
      sent++;
    }
  }

  return sent;
}

async function sendAlertToReviewers(c: CaseRow, tier: AlertTier, daysRemaining: number): Promise<void> {
  const userIds = await getPendingReviewerUserIds(c);
  if (userIds.length === 0) return;

  const { title, message } = buildAlertMessage(tier, c.numero_tramite, c.titulo, daysRemaining);
  const notifType = tierToNotificationType(tier);

  for (const userId of userIds) {
    try {
      await NotificationService.createNotification({
        userId,
        tramiteId: c.id,
        type: notifType,
        title,
        message,
      });
    } catch (e) {
      console.error('[deadline-alerts] notif', e);
    }
    try {
      await mailDeadlineAlert({
        userId,
        caseId: c.id,
        caseNumber: c.numero_tramite,
        caseTitle: c.titulo,
        tier,
        daysRemaining,
      });
    } catch (e) {
      console.error('[deadline-alerts] mail', e);
    }
  }
}
