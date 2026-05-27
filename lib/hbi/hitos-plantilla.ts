import type { HitoDesembolsoHbi } from '@/types/hbi/cliente.types';
import type { TipoServicioHbi } from '@/types/hbi/operacion.types';

const PLANTILLA_HITOS: Array<{ id: string; nombre: string; porcentaje: number; mesesOffset: number }> = [
  { id: 'H1', nombre: 'Cierre financiero / primer desembolso', porcentaje: 20, mesesOffset: 1 },
  { id: 'H2', nombre: 'Inicio de obra o fase operativa', porcentaje: 35, mesesOffset: 4 },
  { id: 'H3', nombre: 'Avance intermedio del proyecto', porcentaje: 25, mesesOffset: 10 },
  { id: 'H4', nombre: 'Puesta en marcha / cierre final', porcentaje: 20, mesesOffset: 18 },
];

function checklistBase(servicios: TipoServicioHbi[]): Array<{ item: string; cumplido: boolean }> {
  const items: string[] = ['Contrato marco firmado', 'Acta de comité de crédito'];
  if (servicios.includes('ANEXO_1_ADMINISTRATIVO')) {
    items.push('Validación administrativa (Anexo 1)');
    items.push('Solicitud formal de desembolso');
  }
  if (servicios.includes('ANEXO_2_GARANTIAS')) {
    items.push('Pólizas y garantías vigentes (Anexo 2)');
  }
  if (servicios.includes('ANEXO_3_CALCULO')) {
    items.push('Cronograma y certificación de saldos (Anexo 3)');
  }
  return items.map((item) => ({ item, cumplido: false }));
}

function fechaObjetivo(mesesOffset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + mesesOffset);
  return d.toISOString();
}

/** Genera hitos con montos calculados desde el monto total aprobado. */
export function generarHitosDesembolso(
  montoTotal: number,
  servicios: TipoServicioHbi[]
): HitoDesembolsoHbi[] {
  return PLANTILLA_HITOS.map((h) => {
    const monto = Math.round((montoTotal * h.porcentaje) / 100);
    return {
      id: h.id,
      nombre: h.nombre,
      porcentaje: h.porcentaje,
      monto,
      montoAprobado: 0,
      aprobado: false,
      estado: 'PENDIENTE_APROBACION',
      fechaObjetivo: fechaObjetivo(h.mesesOffset),
      checklistDocumental: checklistBase(servicios),
    };
  });
}

export function recalcularMontosHitos(
  hitos: HitoDesembolsoHbi[],
  montoTotal: number
): HitoDesembolsoHbi[] {
  return hitos.map((h) => {
    const monto = Math.round((montoTotal * h.porcentaje) / 100);
    return {
      ...h,
      monto,
      montoAprobado: h.aprobado ? h.montoAprobado || monto : h.montoAprobado,
    };
  });
}

export function formatearMonto(valor: number, moneda: 'USD' | 'COP'): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: moneda,
    maximumFractionDigits: moneda === 'USD' ? 0 : 0,
  }).format(valor);
}
