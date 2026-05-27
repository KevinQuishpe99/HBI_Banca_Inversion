import type { TipoDocumentoContractual } from '@/types/hbi/operacion.types';

/** Clasifica documento contractual por nombre de archivo (Anexos 1–3 y tipos del PDF). */
export function clasificarDocumentoPorNombre(nombreArchivo: string): {
  tipo: TipoDocumentoContractual;
  confianza: number;
} {
  const n = nombreArchivo.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

  if (/anexo[\s_-]*1|administrativ|agente[\s_-]*admin/i.test(n)) {
    return { tipo: 'ANEXO_1', confianza: 0.92 };
  }
  if (/anexo[\s_-]*2|garanti/i.test(n)) {
    return { tipo: 'ANEXO_2', confianza: 0.92 };
  }
  if (/anexo[\s_-]*3|calculo|calcul/i.test(n)) {
    return { tipo: 'ANEXO_3', confianza: 0.92 };
  }
  if (/cronograma|schedule|calendario/i.test(n)) {
    return { tipo: 'CRONOGRAMA', confianza: 0.88 };
  }
  if (/garantia|collateral|hipoteca/i.test(n)) {
    return { tipo: 'GARANTIA', confianza: 0.85 };
  }
  if (/contrato[\s_-]*marco|marco|master|facility/i.test(n)) {
    return { tipo: 'CONTRATO_MARCO', confianza: 0.9 };
  }

  return { tipo: 'OTRO', confianza: 0.5 };
}
