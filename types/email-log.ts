/** Tipos de correo registrados en auditoría. */
export type EmailLogTipo =
  | 'CASE_RETURNED'
  | 'CASE_APPROVED'
  | 'CASE_COMPLETED'
  | 'CASE_AREA_NEW'
  | 'CASE_RESUBMITTED'
  | 'DEADLINE_ALERT'
  | 'CASE_HIGH_AMOUNT'
  | 'ACCOUNT_CREDENTIALS'
  | 'TEST_MAIL'
  | 'ADMIN_COMUNICADO'
  | 'HBI_OPERACION'
  | 'HBI_NOTIFICACION'
  | 'HBI_COMUNICADO';

export type EmailLogEstado = 'enviado' | 'fallido';

export type EmailLogRecord = {
  id: string;
  tipo: EmailLogTipo;
  estado: EmailLogEstado;
  destinatarioEmail: string;
  destinatarioUsuarioId: string | null;
  destinatarioNombre: string | null;
  remitente: string | null;
  asunto: string;
  cuerpoTexto: string | null;
  cuerpoHtml: string | null;
  usaHtml: boolean;
  envioLoteId: string | null;
  tramiteId: string | null;
  numeroTramite: string | null;
  operacionId: string | null;
  codigoOperacion: string | null;
  tieneVistaHtml?: boolean;
  mensajeError: string | null;
  creadoEn: string;
};

export type EmailLogListResult = {
  items: EmailLogRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export const EMAIL_LOG_TIPO_LABELS: Record<EmailLogTipo, string> = {
  CASE_RETURNED: 'Trámite devuelto',
  CASE_APPROVED: 'Trámite revisado',
  CASE_COMPLETED: 'Trámite completado',
  CASE_AREA_NEW: 'Nuevo trámite en área',
  CASE_RESUBMITTED: 'Trámite reenviado',
  DEADLINE_ALERT: 'Alerta de plazo',
  CASE_HIGH_AMOUNT: 'Alerta de monto',
  ACCOUNT_CREDENTIALS: 'Credenciales de cuenta',
  TEST_MAIL: 'Prueba técnica',
  ADMIN_COMUNICADO: 'Comunicado administrativo',
  HBI_OPERACION: 'HBI — Correo de operación',
  HBI_NOTIFICACION: 'HBI — Notificación automática',
  HBI_COMUNICADO: 'HBI — Comunicado',
};
