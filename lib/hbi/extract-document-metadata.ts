import type { TipoDocumentoContractual } from '@/types/hbi/operacion.types';

export interface DatosExtraidosDocumento {
  nombreArchivo: string;
  tipoDetectado: TipoDocumentoContractual;
  posibleMonto?: string;
  posibleFecha?: string;
  referenciaCredito?: string;
  partesMencionadas: string[];
  extraidoEn: string;
}

/** Extracción heurística de información clave (extensible a OCR/IA). */
export function extraerDatosClaveDocumento(
  nombreArchivo: string,
  tipo: TipoDocumentoContractual
): DatosExtraidosDocumento {
  const base = nombreArchivo.replace(/\.[^.]+$/, '');
  const montoMatch = base.match(/(?:usd|eur|\$)\s*[\d.,]+|[\d.,]+\s*(?:usd|millones?)/i);
  const fechaMatch = base.match(/\d{4}[-_/]\d{2}[-_/]\d{2}|\d{2}[-_/]\d{2}[-_/]\d{4}/);
  const refMatch = base.match(/cred[\s_-]*\d+|oper[\s_-]*\d+/i);

  const partes: string[] = [];
  if (/deudor|borrower/i.test(base)) partes.push('deudor');
  if (/acreedor|lender|banco/i.test(base)) partes.push('acreedor');
  if (/hbi|agente/i.test(base)) partes.push('agente_hbi');

  return {
    nombreArchivo,
    tipoDetectado: tipo,
    posibleMonto: montoMatch?.[0],
    posibleFecha: fechaMatch?.[0],
    referenciaCredito: refMatch?.[0],
    partesMencionadas: partes,
    extraidoEn: new Date().toISOString(),
  };
}
