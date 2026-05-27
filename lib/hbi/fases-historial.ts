import type { FaseWorkflowHbi, RegistroFaseHbi } from '@/types/hbi/operacion.types';
import { FASES_WORKFLOW } from '@/types/hbi/operacion.types';

const ORDEN: FaseWorkflowHbi[] = [
  'FASE_1_CONTRATOS',
  'FASE_2_CORREOS',
  'FASE_3_EXPEDIENTE',
  'FASE_4_SEGUIMIENTO',
];

export function tituloFase(codigo: FaseWorkflowHbi): string {
  return FASES_WORKFLOW.find((f) => f.codigo === codigo)?.titulo ?? codigo;
}

export function historialFasesDe(
  metadata: Record<string, unknown> | undefined,
  creadoEn: string
): RegistroFaseHbi[] {
  const raw = metadata?.fasesHistorial;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw as RegistroFaseHbi[];
  }
  return [
    {
      fase: 'FASE_1_CONTRATOS',
      titulo: tituloFase('FASE_1_CONTRATOS'),
      abiertaEn: creadoEn,
    },
  ];
}

export function sincronizarHistorialAlAvanzar(
  metadata: Record<string, unknown>,
  faseAnterior: FaseWorkflowHbi,
  faseNueva: FaseWorkflowHbi,
  usuario: string
): RegistroFaseHbi[] {
  const ahora = new Date().toISOString();
  const hist = [...historialFasesDe(metadata, ahora)];

  const actual = hist.find((h) => h.fase === faseAnterior && !h.cerradaEn);
  if (actual) actual.cerradaEn = ahora;

  let siguiente = hist.find((h) => h.fase === faseNueva);
  if (!siguiente) {
    siguiente = {
      fase: faseNueva,
      titulo: tituloFase(faseNueva),
      abiertaEn: ahora,
      abiertaPor: usuario,
    };
    hist.push(siguiente);
  } else {
    if (!siguiente.abiertaEn) siguiente.abiertaEn = ahora;
    if (!siguiente.abiertaPor) siguiente.abiertaPor = usuario;
    siguiente.cerradaEn = undefined;
  }

  return hist.sort(
    (a, b) => ORDEN.indexOf(a.fase) - ORDEN.indexOf(b.fase)
  );
}

export function crearHistorialInicial(creadoEn: string, usuario: string): RegistroFaseHbi[] {
  return [
    {
      fase: 'FASE_1_CONTRATOS',
      titulo: tituloFase('FASE_1_CONTRATOS'),
      abiertaEn: creadoEn,
      abiertaPor: usuario,
    },
  ];
}
