import type { ChecklistItemHito, HitoDesembolsoHbi } from '@/types/hbi/cliente.types';
import type { TipoServicioHbi } from '@/types/hbi/operacion.types';
import { faseProyectoPorIndice } from '@/lib/hbi/desembolsos-domain';

const NOMBRES_SUGERIDOS = [
  'Cierre financiero / primer desembolso',
  'Inicio de obra o fase operativa',
  'Avance intermedio del proyecto',
  'Hito técnico 60%',
  'Puesta en marcha parcial',
  'Puesta en marcha / cierre final',
  'Desembolso complementario',
  'Desembolso final de cierre',
];

const DESCRIPCIONES_SUGERIDAS = [
  'Cierre financiero del crédito sindicado y primer giro al deudor tras firma de contratos y comité.',
  'Inicio de obra civil u operación: certificación de garantías y acta de inicio.',
  'Avance intermedio: interventoría, modelo financiero actualizado y cumplimiento de covenants.',
  'Hito técnico de avance del proyecto según cronograma contractual.',
  'Puesta en marcha parcial de activos o unidades del proyecto.',
  'Puesta en operación comercial y desembolso final condicionado a recepción de obra.',
  'Desembolso complementario por variación aprobada en comité.',
  'Liquidación final y cierre del facility sindicado.',
];

/** Actualiza checklist de cada hito al cambiar servicios contratados (conserva ítems cumplidos). */
export function actualizarChecklistHitosPorServicios(
  hitos: HitoDesembolsoHbi[],
  servicios: TipoServicioHbi[]
): HitoDesembolsoHbi[] {
  return hitos.map((h, i) => {
    const nuevo = checklistBase(servicios, i);
    const prev = h.checklistDocumental ?? [];
    return {
      ...h,
      checklistDocumental: nuevo.map((n) => {
        const ant = prev.find((p) => p.anexo === n.anexo && p.item === n.item);
        return ant ? { ...n, cumplido: ant.cumplido } : n;
      }),
    };
  });
}

function checklistBase(servicios: TipoServicioHbi[], indice: number): ChecklistItemHito[] {
  const items: ChecklistItemHito[] = [
    { item: 'Contrato marco y anexos vigentes', cumplido: false, anexo: 'HBI' },
    { item: 'Acta de comité de crédito / acreedores', cumplido: false, anexo: 'HBI' },
  ];
  if (servicios.includes('ANEXO_1_ADMINISTRATIVO')) {
    items.push({
      item: `Solicitud formal de desembolso ${indice + 1} (Agente Administrativo)`,
      cumplido: false,
      anexo: 'ANEXO_1',
      requiereArchivo: true,
    });
  }
  if (servicios.includes('ANEXO_2_GARANTIAS')) {
    items.push({
      item: `Certificación de garantías vigentes — desembolso ${indice + 1}`,
      cumplido: false,
      anexo: 'ANEXO_2',
      requiereArchivo: true,
    });
  }
  if (servicios.includes('ANEXO_3_CALCULO')) {
    items.push({
      item: `Cronograma y certificación de saldos — desembolso ${indice + 1}`,
      cumplido: false,
      anexo: 'ANEXO_3',
      requiereArchivo: true,
    });
  }
  return items;
}

function fechaDesdeMeses(mesesOffset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + mesesOffset);
  return d.toISOString();
}

function crearHitoBase(
  indice: number,
  total: number,
  porcentaje: number,
  montoTotal: number,
  servicios: TipoServicioHbi[],
  mesesOffset: number
): HitoDesembolsoHbi {
  const monto = Math.round((montoTotal * porcentaje) / 100);
  return {
    id: `H${indice + 1}`,
    nombre: NOMBRES_SUGERIDOS[indice] ?? `Desembolso fase ${indice + 1}`,
    porcentaje,
    monto,
    montoAprobado: 0,
    aprobado: false,
    estado: 'PENDIENTE_APROBACION',
    fechaObjetivo: fechaDesdeMeses(mesesOffset),
    descripcionFase: DESCRIPCIONES_SUGERIDAS[indice] ?? '',
    faseProyecto: faseProyectoPorIndice(indice, total),
    fechaDesembolsoEjecutado: null,
    evidencias: [],
    checklistDocumental: checklistBase(servicios, indice),
  };
}

/** Reparte 100% entre N desembolsos (el último absorbe el redondeo). */
export function repartirPorcentajes(cantidad: number): number[] {
  const n = Math.max(1, Math.min(8, cantidad));
  const base = Math.floor(100 / n);
  const resto = 100 - base * n;
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? base + resto : base));
}

/** Genera N desembolsos con % equitativo y fechas escalonadas en el proyecto. */
export function generarHitosPorCantidad(
  cantidad: number,
  montoTotal: number,
  servicios: TipoServicioHbi[]
): HitoDesembolsoHbi[] {
  const n = Math.max(2, Math.min(8, cantidad));
  const porcentajes = repartirPorcentajes(n);
  const plazoMeses = 18;

  return porcentajes.map((porcentaje, i) => {
    const meses =
      n === 1 ? 1 : Math.max(1, Math.round((i / (n - 1)) * plazoMeses) + 1);
    return crearHitoBase(i, n, porcentaje, montoTotal, servicios, meses);
  });
}

const PLANTILLA_HITOS: Array<{ id: string; nombre: string; porcentaje: number; mesesOffset: number }> = [
  { id: 'H1', nombre: 'Cierre financiero / primer desembolso', porcentaje: 20, mesesOffset: 1 },
  { id: 'H2', nombre: 'Inicio de obra o fase operativa', porcentaje: 35, mesesOffset: 4 },
  { id: 'H3', nombre: 'Avance intermedio del proyecto', porcentaje: 25, mesesOffset: 10 },
  { id: 'H4', nombre: 'Puesta en marcha / cierre final', porcentaje: 20, mesesOffset: 18 },
];

/** Genera 4 hitos estándar (compatibilidad). */
export function generarHitosDesembolso(
  montoTotal: number,
  servicios: TipoServicioHbi[]
): HitoDesembolsoHbi[] {
  return PLANTILLA_HITOS.map((h, i) =>
    crearHitoBase(i, PLANTILLA_HITOS.length, h.porcentaje, montoTotal, servicios, h.mesesOffset)
  );
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
      montoAprobado: h.aprobado || h.estado === 'COMPLETADO' ? h.montoAprobado || monto : h.montoAprobado,
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

export function fechaInputDesdeIso(iso: string): string {
  return iso.slice(0, 10);
}

export function isoDesdeFechaInput(fecha: string): string {
  return new Date(`${fecha}T12:00:00`).toISOString();
}
