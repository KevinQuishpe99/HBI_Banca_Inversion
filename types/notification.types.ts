export type NotificationType =
  | 'CASE_SUBMITTED'           // Trámite enviado para revisión (para área)
  | 'CASE_APPROVED'            // Trámite aprobado por un área (para creador)
  | 'CASE_RETURNED'            // Trámite devuelto para correcciones (para creador)
  | 'CASE_REJECTED'            // Legado BD; no se genera — usar CASE_RETURNED
  | 'CASE_RESUBMITTED'         // Trámite reenviado después de correcciones (para área)
  | 'CASE_COMPLETED'           // Trámite completado (para creador)
  | 'CASE_COMMENT'             // Nuevo comentario en trámite
  | 'CASE_HIGH_AMOUNT'         // Monto del trámite alcanza o supera el umbral (Comercial, Legal, Director)
  | 'CASE_DEADLINE_REMINDER'   // Recordatorio: faltan N días para la fecha límite
  | 'CASE_DEADLINE_URGENT'     // Urgente: fecha límite es hoy/mañana
  | 'CASE_DEADLINE_OVERDUE';   // Vencido: fecha límite ya pasó y trámite no completado

export interface Notification {
  id: string;
  userId: string;
  tramiteId: string;
  caseNumber: string;
  caseTitle: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

export interface CreateNotificationDTO {
  userId: string;
  tramiteId: string;
  type: NotificationType;
  title: string;
  message: string;
}

export interface NotificationStats {
  unreadCount: number;
}
