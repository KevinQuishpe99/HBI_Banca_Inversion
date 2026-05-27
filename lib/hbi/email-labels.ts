import { EMAIL_LOG_TIPO_LABELS, type EmailLogTipo } from '@/types/email-log';

export function etiquetaTipoCorreoEnviado(tipo: string): string {
  const t = tipo as EmailLogTipo;
  return EMAIL_LOG_TIPO_LABELS[t] ?? tipo;
}
