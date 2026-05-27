import type {
  FaseWorkflowHbi,
  TipoDocumentoContractual,
  TipoServicioHbi,
} from '@/types/hbi/operacion.types';

const ORDEN_FASES: FaseWorkflowHbi[] = [
  'FASE_1_CONTRATOS',
  'FASE_2_CORREOS',
  'FASE_3_EXPEDIENTE',
  'FASE_4_SEGUIMIENTO',
];

export type RequisitoFase = {
  codigo: string;
  descripcion: string;
  cumplido: boolean;
  obligatorio: boolean;
};

export function validarAvanceFase(input: {
  faseActual: FaseWorkflowHbi;
  faseDestino: FaseWorkflowHbi;
  totalDocumentos: number;
  tiposDocumento: TipoDocumentoContractual[];
  totalCorreos: number;
  correosUrgentes: number;
  serviciosActivos: TipoServicioHbi[];
  totalActividades: number;
  actividadesCompletadas: number;
  tieneResponsable: boolean;
}): { permitido: boolean; requisitos: RequisitoFase[]; mensaje?: string } {
  const idxActual = ORDEN_FASES.indexOf(input.faseActual);
  const idxDestino = ORDEN_FASES.indexOf(input.faseDestino);

  if (idxDestino !== idxActual + 1) {
    return {
      permitido: false,
      requisitos: [],
      mensaje: 'Solo puede avanzar a la fase inmediatamente siguiente.',
    };
  }

  const requisitos: RequisitoFase[] = [];

  if (input.faseActual === 'FASE_1_CONTRATOS') {
    requisitos.push({
      codigo: 'DOC_MIN',
      descripcion: 'Al menos un documento contractual cargado en el paquete del crédito',
      cumplido: input.totalDocumentos >= 1,
      obligatorio: true,
    });
    requisitos.push({
      codigo: 'PAQUETE_IDENTIFICADO',
      descripcion: 'Paquete contractual identificado (contrato marco o anexo)',
      cumplido:
        input.tiposDocumento.includes('CONTRATO_MARCO') ||
        input.tiposDocumento.some((t) => ['ANEXO_1', 'ANEXO_2', 'ANEXO_3'].includes(t)),
      obligatorio: true,
    });
  }

  if (input.faseActual === 'FASE_2_CORREOS') {
    requisitos.push({
      codigo: 'CORREO_MIN',
      descripcion: 'Al menos un correo registrado en la bandeja de la operación',
      cumplido: input.totalCorreos >= 1,
      obligatorio: true,
    });
    requisitos.push({
      codigo: 'CANAL_HABILITADO',
      descripcion: 'Canal de comunicaciones con origen identificado (Agente–HBI, Deudor o Acreedor)',
      cumplido: input.totalCorreos >= 1,
      obligatorio: true,
    });
  }

  if (input.faseActual === 'FASE_3_EXPEDIENTE') {
    requisitos.push({
      codigo: 'EXPEDIENTE_DOCS',
      descripcion: 'Expediente consolidado con data contractual',
      cumplido: input.totalDocumentos >= 1,
      obligatorio: true,
    });
    requisitos.push({
      codigo: 'RESPONSABLE',
      descripcion: 'Responsable de operación asignado',
      cumplido: input.tieneResponsable,
      obligatorio: false,
    });
  }

  if (input.faseActual === 'FASE_3_EXPEDIENTE' && input.faseDestino === 'FASE_4_SEGUIMIENTO') {
    requisitos.push({
      codigo: 'SERVICIOS_DEFINIDOS',
      descripcion: 'Servicios activos (Anexos 1, 2 y/o 3) definidos para el crédito',
      cumplido: input.serviciosActivos.length >= 1,
      obligatorio: true,
    });
  }

  const bloqueantes = requisitos.filter((r) => r.obligatorio && !r.cumplido);
  return {
    permitido: bloqueantes.length === 0,
    requisitos,
    mensaje:
      bloqueantes.length > 0
        ? `Requisitos pendientes: ${bloqueantes.map((r) => r.descripcion).join('; ')}`
        : undefined,
  };
}

export function calcularAvancePorAnexo(
  servicios: TipoServicioHbi[],
  actividades: Array<{ tipoServicio: TipoServicioHbi; estado: string }>
): Record<TipoServicioHbi, { total: number; completadas: number; porcentaje: number }> {
  const map = {} as Record<
    TipoServicioHbi,
    { total: number; completadas: number; porcentaje: number }
  >;

  for (const s of servicios) {
    const delServicio = actividades.filter((a) => a.tipoServicio === s);
    const total = delServicio.length;
    const completadas = delServicio.filter((a) => a.estado === 'COMPLETADA').length;
    map[s] = {
      total,
      completadas,
      porcentaje: total === 0 ? 0 : Math.round((completadas / total) * 100),
    };
  }
  return map;
}
