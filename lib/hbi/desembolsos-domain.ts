import type { ChecklistItemHito, HitoDesembolsoHbi } from '@/types/hbi/cliente.types';
import type { TipoServicioHbi } from '@/types/hbi/operacion.types';

export const FASES_PROYECTO_HBI = [
  { codigo: 'PRECONSTRUCCION', label: 'Pre-construcción / cierre financiero' },
  { codigo: 'CONSTRUCCION_INICIO', label: 'Construcción — inicio de obra' },
  { codigo: 'CONSTRUCCION_AVANCE', label: 'Construcción — avance intermedio' },
  { codigo: 'OPERACION', label: 'Operación / puesta en marcha' },
  { codigo: 'CIERRE', label: 'Cierre y liquidación' },
] as const;

export type CodigoFaseProyectoHbi = (typeof FASES_PROYECTO_HBI)[number]['codigo'];

export function labelFaseProyecto(codigo: string | undefined): string {
  return FASES_PROYECTO_HBI.find((f) => f.codigo === codigo)?.label ?? codigo ?? '—';
}

export function faseProyectoPorIndice(indice: number, total: number): CodigoFaseProyectoHbi {
  if (indice === 0) return 'PRECONSTRUCCION';
  if (indice === total - 1) return 'OPERACION';
  if (indice === total - 2 && total > 2) return 'CONSTRUCCION_AVANCE';
  return 'CONSTRUCCION_INICIO';
}

function inferirAnexoChecklist(item: string): ChecklistItemHito['anexo'] {
  const lower = item.toLowerCase();
  if (lower.includes('anexo 1') || lower.includes('administrativo')) return 'ANEXO_1';
  if (lower.includes('anexo 2') || lower.includes('garant')) return 'ANEXO_2';
  if (
    lower.includes('anexo 3') ||
    lower.includes('cronograma') ||
    lower.includes('cálculo') ||
    lower.includes('calculo')
  ) {
    return 'ANEXO_3';
  }
  return 'HBI';
}

/** Normaliza hitos persistidos en formato antiguo (sin anexo en checklist). */
export function normalizarHitoDesembolso(hito: HitoDesembolsoHbi): HitoDesembolsoHbi {
  return {
    ...hito,
    evidencias: hito.evidencias ?? [],
    descripcionFase: hito.descripcionFase ?? '',
    fechaDesembolsoEjecutado: hito.fechaDesembolsoEjecutado ?? null,
    checklistDocumental: (hito.checklistDocumental ?? []).map((c) => ({
      item: c.item ?? 'Ítem documental',
      cumplido: Boolean(c.cumplido),
      anexo: c.anexo ?? inferirAnexoChecklist(c.item ?? ''),
      requiereArchivo: c.requiereArchivo,
    })),
  };
}

export function normalizarHitosOperacion(hitos: HitoDesembolsoHbi[]): HitoDesembolsoHbi[] {
  return hitos.map(normalizarHitoDesembolso);
}

export function hitosNecesitanMigracion(hitos: HitoDesembolsoHbi[]): boolean {
  return hitos.some(
    (h) =>
      !h.evidencias ||
      h.descripcionFase === undefined ||
      h.descripcionFase === null ||
      (h.checklistDocumental ?? []).some((c) => typeof c.anexo !== 'string')
  );
}

/** Etiqueta segura para UI (nunca lanza si anexo viene mal del caché). */
export function labelAnexoChecklist(anexo: unknown): string | null {
  if (typeof anexo !== 'string' || anexo.length === 0 || anexo === 'HBI') return null;
  return anexo.replace(/_/g, ' ');
}

export function labelEstadoHito(estado: unknown): string {
  if (typeof estado !== 'string' || !estado) return 'Pendiente';
  return estado.replace(/_/g, ' ');
}

export function ordenarHitos(hitos: HitoDesembolsoHbi[]): HitoDesembolsoHbi[] {
  return [...hitos].sort((a, b) => {
    const na = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
    const nb = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
    return na - nb;
  });
}

export function calcularAvanceDesembolsos(hitos: HitoDesembolsoHbi[]) {
  const ordenados = ordenarHitos(hitos);
  const completados = ordenados.filter((h) => h.estado === 'COMPLETADO');
  const porcentajeEjecutado = completados.reduce((s, h) => s + h.porcentaje, 0);
  const montoEjecutado = completados.reduce(
    (s, h) => s + (h.montoAprobado || h.monto || 0),
    0
  );
  const hitoActivo =
    ordenados.find((h) => h.estado !== 'COMPLETADO') ?? ordenados[ordenados.length - 1];
  const faseActual = hitoActivo?.faseProyecto ?? ordenados[0]?.faseProyecto;

  return {
    porcentajeEjecutado,
    montoEjecutado,
    desembolsosCompletados: completados.length,
    totalDesembolsos: ordenados.length,
    hitoActivo,
    faseActual,
  };
}

export function hitoAnteriorCompleto(
  hitos: HitoDesembolsoHbi[],
  hitoId: string
): boolean {
  const ordenados = ordenarHitos(hitos);
  const idx = ordenados.findIndex((h) => h.id === hitoId);
  if (idx <= 0) return true;
  return ordenados[idx - 1]?.estado === 'COMPLETADO';
}

const ANEXO_SERVICIO: Record<string, TipoServicioHbi> = {
  ANEXO_1: 'ANEXO_1_ADMINISTRATIVO',
  ANEXO_2: 'ANEXO_2_GARANTIAS',
  ANEXO_3: 'ANEXO_3_CALCULO',
};

/** Valida checklist + archivos de evidencia por Anexo activo. */
export function evaluarRequisitosHito(
  hito: HitoDesembolsoHbi,
  serviciosActivos: TipoServicioHbi[]
): { listo: boolean; faltantes: string[] } {
  const faltantes: string[] = [];
  const checklist = hito.checklistDocumental ?? [];
  const evidencias = hito.evidencias ?? [];

  for (const c of checklist) {
    if (!c.cumplido) {
      faltantes.push(`Checklist: ${c.item}`);
    }
  }

  for (const anexo of ['ANEXO_1', 'ANEXO_2', 'ANEXO_3'] as const) {
    const servicio = ANEXO_SERVICIO[anexo];
    if (!serviciosActivos.includes(servicio)) continue;
    const tieneArchivo = evidencias.some((e) => e.anexoRequerido === anexo);
    if (!tieneArchivo) {
      const nombre =
        anexo === 'ANEXO_1'
          ? 'Agente Administrativo (Anexo 1)'
          : anexo === 'ANEXO_2'
            ? 'Agente de Garantías (Anexo 2)'
            : 'Agente de Cálculo (Anexo 3)';
      faltantes.push(`Archivo de evidencia — ${nombre}`);
    }
  }

  if (!hito.descripcionFase?.trim()) {
    faltantes.push('Descripción de la fase del proyecto');
  }

  return { listo: faltantes.length === 0, faltantes };
}

export function puedeEjecutarDesembolso(
  hitos: HitoDesembolsoHbi[],
  hitoId: string,
  serviciosActivos: TipoServicioHbi[]
): { permitido: boolean; motivo?: string } {
  const hito = hitos.find((h) => h.id === hitoId);
  if (!hito) return { permitido: false, motivo: 'Hito no encontrado' };
  if (hito.estado === 'COMPLETADO') {
    return { permitido: false, motivo: 'Este desembolso ya fue ejecutado' };
  }
  if (!hitoAnteriorCompleto(hitos, hitoId)) {
    return {
      permitido: false,
      motivo: 'Debe completar el desembolso anterior antes de habilitar este',
    };
  }
  const req = evaluarRequisitosHito(hito, serviciosActivos);
  if (!req.listo) {
    return { permitido: false, motivo: req.faltantes[0] };
  }
  return { permitido: true };
}
