import type { OrigenCorreoHbi, PrioridadCorreoHbi } from '@/types/hbi/operacion.types';

/** Detecta origen del correo según remitente/asunto (Agente–HBI, Deudor, Acreedor). */
export function detectarOrigenCorreo(remitente: string, asunto: string): OrigenCorreoHbi {
  const texto = `${remitente} ${asunto}`.toLowerCase();

  if (/hbi|helm|agente[\s_-]*financ|banca[\s_-]*inversion/i.test(texto)) {
    return 'AGENTE_HBI';
  }
  if (/deudor|borrower|cliente|emisor/i.test(texto)) {
    return 'DEUDOR';
  }
  if (/acreedor|lender|banco|fondo|syndic|participante/i.test(texto)) {
    return 'ACREEDOR';
  }
  return 'OTRO';
}

export function detectarPrioridadCorreo(asunto: string, cuerpo?: string): PrioridadCorreoHbi {
  const texto = `${asunto} ${cuerpo ?? ''}`.toLowerCase();
  if (/urgente|urgency|asap|inmediat/i.test(texto)) return 'URGENTE';
  if (/importante|alta prioridad|high priority/i.test(texto)) return 'ALTA';
  if (/baja prioridad|low priority|fyi/i.test(texto)) return 'BAJA';
  return 'MEDIA';
}
