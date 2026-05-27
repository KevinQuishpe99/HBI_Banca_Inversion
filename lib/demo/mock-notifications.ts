import type { Notification } from '@/types/notification.types';

/** Estado de lectura en memoria (persiste mientras el proceso serverless esté caliente). */
const estadoLectura = new Map<string, { isRead: boolean; readAt?: Date }>();

interface NotificacionSemilla extends Omit<Notification, 'isRead' | 'readAt'> {
  leidaPorDefecto?: boolean;
}

const SEMILLAS: NotificacionSemilla[] = [
  {
    id: 'demo-notif-001',
    userId: 'demo-user-maria',
    tramiteId: 'mock-op-007',
    caseNumber: 'CRED-2026-00007',
    caseTitle: 'Project Finance Metro Verde',
    type: 'CASE_DEADLINE_REMINDER',
    title: 'Checklist H2 pendiente',
    message: 'Faltan documentos para el hito H2 (desembolso infraestructura). Revise el expediente 360.',
    leidaPorDefecto: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: 'demo-notif-002',
    userId: 'demo-user-maria',
    tramiteId: 'mock-op-001',
    caseNumber: 'CRED-2026-00001',
    caseTitle: 'Crédito sindicado Agroindustrial',
    type: 'CASE_SUBMITTED',
    title: 'Correo de acreedor registrado',
    message: 'Nuevo correo en bandeja HBI vinculado a la operación. Clasificación sugerida: solicitud documental.',
    leidaPorDefecto: false,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
  {
    id: 'demo-notif-003',
    userId: 'demo-user-carlos',
    tramiteId: 'mock-op-007',
    caseNumber: 'CRED-2026-00007',
    caseTitle: 'Project Finance Metro Verde',
    type: 'CASE_DEADLINE_URGENT',
    title: 'Garantía fiduciaria — vencimiento próximo',
    message: 'La póliza de cumplimiento del Anexo 2 vence en 3 días. Actualice el expediente de garantías.',
    leidaPorDefecto: false,
    createdAt: new Date(Date.now() - 45 * 60 * 1000),
  },
  {
    id: 'demo-notif-004',
    userId: 'demo-user-ana',
    tramiteId: 'mock-op-003',
    caseNumber: 'CRED-2026-00003',
    caseTitle: 'Refinanciación Energía Solar',
    type: 'CASE_COMMENT',
    title: 'Recálculo de cuota solicitado',
    message: 'El acreedor solicitó escenario con tasa SOFR + 275 bps. Valide el Anexo 3 de cálculo.',
    leidaPorDefecto: false,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
  },
  {
    id: 'demo-notif-005',
    userId: 'demo-user-director',
    tramiteId: 'mock-op-007',
    caseNumber: 'CRED-2026-00007',
    caseTitle: 'Project Finance Metro Verde',
    type: 'CASE_HIGH_AMOUNT',
    title: 'Operación premium en seguimiento',
    message: 'Desembolso H2 por USD 45M requiere aprobación de director. Revise trazabilidad documental.',
    leidaPorDefecto: false,
    createdAt: new Date(Date.now() - 30 * 60 * 1000),
  },
  {
    id: 'demo-notif-006',
    userId: 'demo-user-deudor',
    tramiteId: 'mock-op-002',
    caseNumber: 'CRED-2026-00002',
    caseTitle: 'Línea corporativa Retail Andino',
    type: 'CASE_RETURNED',
    title: 'Documentación devuelta',
    message: 'Estados financieros auditados requieren firma del representante legal. Suba versión corregida.',
    leidaPorDefecto: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    id: 'demo-notif-007',
    userId: 'demo-user-acreedor',
    tramiteId: 'mock-op-004',
    caseNumber: 'CRED-2026-00004',
    caseTitle: 'Syndicated Loan Infraestructura',
    type: 'CASE_APPROVED',
    title: 'Acta de comité disponible',
    message: 'El acta de aprobación del comité de crédito está en el expediente 360 para su revisión.',
    leidaPorDefecto: false,
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
  },
];

function materializar(notif: NotificacionSemilla): Notification {
  const estado = estadoLectura.get(notif.id);
  const isRead = estado?.isRead ?? notif.leidaPorDefecto ?? false;
  return {
    id: notif.id,
    userId: notif.userId,
    tramiteId: notif.tramiteId,
    caseNumber: notif.caseNumber,
    caseTitle: notif.caseTitle,
    type: notif.type,
    title: notif.title,
    message: notif.message,
    isRead,
    readAt: estado?.readAt,
    createdAt: notif.createdAt,
  };
}

export function obtenerNotificacionesDemo(
  userId: string,
  unreadOnly: boolean,
  limit: number
): Notification[] {
  let lista = SEMILLAS.filter((n) => n.userId === userId).map(materializar);
  if (unreadOnly) {
    lista = lista.filter((n) => !n.isRead);
  }
  return lista
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export function contarNoLeidasDemo(userId: string): number {
  return obtenerNotificacionesDemo(userId, true, 999).length;
}

export function marcarLeidaDemo(id: string): void {
  estadoLectura.set(id, { isRead: true, readAt: new Date() });
}

export function marcarTodasLeidasDemo(userId: string): void {
  for (const semilla of SEMILLAS) {
    if (semilla.userId === userId) {
      estadoLectura.set(semilla.id, { isRead: true, readAt: new Date() });
    }
  }
}
