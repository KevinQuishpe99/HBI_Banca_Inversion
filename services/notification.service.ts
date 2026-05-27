import { query } from '@/lib/db';
import { Notification, CreateNotificationDTO } from '@/types/notification.types';
import { usaDatosQuemadosHbi } from '@/lib/hbi/mock-config';
import {
  contarNoLeidasDemo,
  marcarLeidaDemo,
  marcarTodasLeidasDemo,
  obtenerNotificacionesDemo,
} from '@/lib/demo/mock-notifications';
import {
  mailAreaNewCase,
  mailAreaResubmitted,
  mailCaseApproved,
  mailCaseCompleted,
  mailCaseReturned,
  mailHighAmountCaseAlert,
} from '@/lib/email/notification-emails';

async function getAreaLabel(areaId: number): Promise<string> {
  const r = await query<{ nombre_area: string }>(
    `SELECT nombre_area FROM configuracion_areas WHERE id = $1`,
    [areaId]
  );
  return r.rows[0]?.nombre_area ?? `Área ${areaId}`;
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

export class NotificationService {
  /**
   * Obtiene las notificaciones de un usuario
   */
  static async getUserNotifications(
    userId: string,
    unreadOnly: boolean = false,
    limit: number = 50
  ): Promise<Notification[]> {
    if (usaDatosQuemadosHbi()) {
      return obtenerNotificacionesDemo(userId, unreadOnly, limit);
    }

    const result = await query<Record<string, unknown>>(
      `SELECT n.id,
              n.usuario_id,
              n.tramite_id,
              t.numero_tramite,
              t.titulo AS titulo_tramite,
              n.tipo,
              n.titulo,
              n.mensaje,
              n.leido,
              n.leido_en,
              n.creado_en
       FROM notificaciones n
       JOIN tramites t ON n.tramite_id = t.id
       WHERE n.usuario_id = $1
         AND ($2::boolean = false OR n.leido = false)
       ORDER BY n.creado_en DESC
       LIMIT $3`,
      [userId, unreadOnly, limit]
    );

    return result.rows.map(this.mapNotificationFromDb);
  }

  /**
   * Cuenta las notificaciones no leídas de un usuario
   */
  static async getUnreadCount(userId: string): Promise<number> {
    if (usaDatosQuemadosHbi()) {
      return contarNoLeidasDemo(userId);
    }

    const result = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM notificaciones WHERE usuario_id = $1 AND leido = false`,
      [userId]
    );
    return result.rows[0]?.n ?? 0;
  }

  /**
   * Marca una notificación como leída
   */
  static async markAsRead(notificationId: string): Promise<void> {
    if (usaDatosQuemadosHbi()) {
      marcarLeidaDemo(notificationId);
      return;
    }

    await query(
      `UPDATE notificaciones SET leido = true, leido_en = CURRENT_TIMESTAMP
       WHERE id = $1 AND leido = false`,
      [notificationId]
    );
  }

  /**
   * Marca todas las notificaciones de un usuario como leídas
   */
  static async markAllAsRead(userId: string): Promise<void> {
    if (usaDatosQuemadosHbi()) {
      marcarTodasLeidasDemo(userId);
      return;
    }

    await query(
      `UPDATE notificaciones SET leido = true, leido_en = CURRENT_TIMESTAMP
       WHERE usuario_id = $1 AND leido = false`,
      [userId]
    );
  }

  /**
   * Crea una nueva notificación
   */
  static async createNotification(data: CreateNotificationDTO): Promise<string> {
    if (usaDatosQuemadosHbi()) {
      return `demo-notif-${Date.now()}`;
    }

    const result = await query<{ id: string }>(
      `INSERT INTO notificaciones (usuario_id, tramite_id, tipo, titulo, mensaje)
       VALUES ($1, $2, $3::notification_type, $4, $5)
       RETURNING id`,
      [data.userId, data.tramiteId, data.type, data.title, data.message]
    );
    return result.rows[0].id;
  }

  /**
   * Notifica al creador del trámite cuando es devuelto
   */
  static async notifyCaseReturned(
    caseId: string,
    caseNumber: string,
    caseTitle: string,
    creatorId: string,
    areaName: string,
    reason: string,
    options?: { returnedByUserId: string; fullDetail: string }
  ): Promise<void> {
    await this.createNotification({
      userId: creatorId,
      tramiteId: caseId,
      type: 'CASE_RETURNED',
      title: `Trámite ${caseNumber} devuelto`,
      message: `El área ${areaName} ha devuelto tu trámite "${caseTitle}" para correcciones. Motivo: ${reason}`,
    });
    if (options?.returnedByUserId) {
      try {
        await mailCaseReturned({
          creatorId,
          caseId,
          caseNumber,
          caseTitle,
          areaName,
          reasonShort: reason,
          fullDetail: options.fullDetail ?? reason,
          returnedByUserId: options.returnedByUserId,
        });
      } catch (e) {
        console.error('[NotificationService] mailCaseReturned', e);
      }
    }
  }

  /**
   * Notifica al creador del trámite cuando es aprobado por un área
   */
  static async notifyCaseApproved(
    caseId: string,
    caseNumber: string,
    caseTitle: string,
    creatorId: string,
    areaName: string,
    options?: { approvedByUserId: string; comments?: string | null }
  ): Promise<void> {
    await this.createNotification({
      userId: creatorId,
      tramiteId: caseId,
      type: 'CASE_APPROVED',
      title: `Trámite ${caseNumber} revisado`,
      message: `El área ${areaName} ha revisado tu trámite "${caseTitle}".`,
    });
    if (options?.approvedByUserId) {
      try {
        await mailCaseApproved({
          creatorId,
          caseId,
          caseNumber,
          caseTitle,
          areaName,
          approvedByUserId: options.approvedByUserId,
          comments: options.comments,
        });
      } catch (e) {
        console.error('[NotificationService] mailCaseApproved', e);
      }
    }
  }

  /** Legado; el flujo usa devolución (`notifyCaseReturned`). */
  static async notifyCaseRejected(
    caseId: string,
    caseNumber: string,
    caseTitle: string,
    creatorId: string,
    areaName: string,
    reason: string
  ): Promise<void> {
    await this.createNotification({
      userId: creatorId,
      tramiteId: caseId,
      type: 'CASE_REJECTED',
      title: `Trámite ${caseNumber} devuelto`,
      message: `El área ${areaName} ha devuelto tu trámite "${caseTitle}" para correcciones. Motivo: ${reason}`,
    });
  }

  /**
   * Notifica al creador del trámite cuando es completado
   */
  static async notifyCaseCompleted(
    caseId: string,
    caseNumber: string,
    caseTitle: string,
    creatorId: string
  ): Promise<void> {
    await this.createNotification({
      userId: creatorId,
      tramiteId: caseId,
      type: 'CASE_COMPLETED',
      title: `Trámite ${caseNumber} completado`,
      message: `Tu trámite "${caseTitle}" ha sido aprobado por todas las áreas y está completado.`,
    });
    try {
      await mailCaseCompleted({
        creatorId,
        caseId,
        caseNumber,
        caseTitle,
        variant: 'workflow',
      });
    } catch (e) {
      console.error('[NotificationService] mailCaseCompleted', e);
    }
  }

  /**
   * Legal da el trámite por completado sin pasar por Director General
   */
  static async notifyCaseLegalCompletedEarly(
    caseId: string,
    caseNumber: string,
    caseTitle: string,
    creatorId: string,
    legalCompletedByUserId?: string
  ): Promise<void> {
    await this.createNotification({
      userId: creatorId,
      tramiteId: caseId,
      type: 'CASE_COMPLETED',
      title: `Trámite ${caseNumber} completado`,
      message: `El área Legal ha dado tu trámite "${caseTitle}" por completado.`,
    });
    try {
      await mailCaseCompleted({
        creatorId,
        caseId,
        caseNumber,
        caseTitle,
        variant: 'legal_early',
        completedByUserId: legalCompletedByUserId,
      });
    } catch (e) {
      console.error('[NotificationService] mailCaseCompleted legal_early', e);
    }
  }

  /**
   * Notifica a los usuarios de un área cuando llega un trámite para revisión
   */
  static async notifyAreaNewCase(
    caseId: string,
    caseNumber: string,
    caseTitle: string,
    areaId: number,
    creatorName: string
  ): Promise<void> {
    const userIds = await getUserIdsForAreaId(areaId);
    const areaLabel = await getAreaLabel(areaId);

    for (const userId of userIds) {
      await this.createNotification({
        userId,
        tramiteId: caseId,
        type: 'CASE_SUBMITTED',
        title: `Nuevo trámite para revisión`,
        message: `El trámite ${caseNumber} "${caseTitle}" de ${creatorName} ha sido asignado al área ${areaLabel} para revisión.`,
      });
      try {
        await mailAreaNewCase({
          userId,
          caseId,
          caseNumber,
          caseTitle,
          areaLabel,
          creatorName,
        });
      } catch (e) {
        console.error('[NotificationService] mailAreaNewCase', e);
      }
    }
  }

  /**
   * Notifica a supervisores/usuarios de áreas configuradas cuando el monto del trámite
   * alcanza o supera el umbral configurado.
   */
  static async notifyHighAmountStakeholders(
    caseId: string,
    caseNumber: string,
    caseTitle: string,
    amount: number,
    threshold: number,
    creatorName: string
  ): Promise<void> {
    const areasRes = await query<{ id: number; nombre_area: string }>(
      `SELECT id, nombre_area FROM configuracion_areas WHERE activo = true AND notificar_monto_alto = true ORDER BY orden ASC`
    );

    for (const areaRow of areasRes.rows) {
      const userIds = await getUserIdsForAreaId(areaRow.id);
      const areaLabel = areaRow.nombre_area;

      for (const userId of userIds) {
        await this.createNotification({
          userId,
          tramiteId: caseId,
          type: 'CASE_HIGH_AMOUNT',
          title: `Alerta de monto — trámite ${caseNumber}`,
          message: `El trámite «${caseTitle}» (${caseNumber}) de ${creatorName} declara USD ${amount.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (umbral: ${threshold.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). Área: ${areaLabel}.`,
        });
        try {
          await mailHighAmountCaseAlert({
            userId,
            caseId,
            caseNumber,
            caseTitle,
            areaLabel,
            creatorName,
            amount,
            threshold,
          });
        } catch (e) {
          console.error('[NotificationService] mailHighAmountCaseAlert', e);
        }
      }
    }
  }

  /**
   * Notifica a los usuarios de un área cuando un trámite es reenviado
   */
  static async notifyAreaCaseResubmitted(
    caseId: string,
    caseNumber: string,
    caseTitle: string,
    areaId: number,
    creatorName: string
  ): Promise<void> {
    const userIds = await getUserIdsForAreaId(areaId);
    const areaLabel = await getAreaLabel(areaId);

    for (const userId of userIds) {
      await this.createNotification({
        userId,
        tramiteId: caseId,
        type: 'CASE_RESUBMITTED',
        title: `Trámite reenviado con correcciones`,
        message: `${creatorName} ha reenviado el trámite ${caseNumber} "${caseTitle}" con las correcciones solicitadas por el área ${areaLabel}.`,
      });
      try {
        await mailAreaResubmitted({
          userId,
          caseId,
          caseNumber,
          caseTitle,
          areaLabel,
          creatorName,
        });
      } catch (e) {
        console.error('[NotificationService] mailAreaResubmitted', e);
      }
    }
  }

  private static mapNotificationFromDb(row: Record<string, unknown>): Notification {
    const tipoRaw = row.tipo;
    const tipoStr = typeof tipoRaw === 'string' ? tipoRaw : String(tipoRaw ?? '');
    const readAt = row.leido_en;
    const createdAt = row.creado_en;
    return {
      id: String(row.id ?? ''),
      userId: String(row.usuario_id ?? ''),
      tramiteId: String(row.tramite_id ?? ''),
      caseNumber: String(row.numero_tramite ?? row.case_number ?? ''),
      caseTitle: String(row.titulo_tramite ?? row.case_title ?? ''),
      type: tipoStr as Notification['type'],
      title: String(row.titulo ?? ''),
      message: String(row.mensaje ?? ''),
      isRead: row.leido === true,
      readAt: readAt instanceof Date ? readAt : readAt != null ? new Date(String(readAt)) : undefined,
      createdAt: createdAt instanceof Date ? createdAt : new Date(String(createdAt ?? '')),
    };
  }
}
