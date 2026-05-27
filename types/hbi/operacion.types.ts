/** Fases del workflow HBI Agente de Financiación (Mayo 2026) */
export type FaseWorkflowHbi =
  | 'FASE_1_CONTRATOS'
  | 'FASE_2_CORREOS'
  | 'FASE_3_EXPEDIENTE'
  | 'FASE_4_SEGUIMIENTO';

export type TipoServicioHbi =
  | 'ANEXO_1_ADMINISTRATIVO'
  | 'ANEXO_2_GARANTIAS'
  | 'ANEXO_3_CALCULO';

export type TipoDocumentoContractual =
  | 'CONTRATO_MARCO'
  | 'ANEXO_1'
  | 'ANEXO_2'
  | 'ANEXO_3'
  | 'CRONOGRAMA'
  | 'GARANTIA'
  | 'OTRO';

export type OrigenCorreoHbi = 'AGENTE_HBI' | 'DEUDOR' | 'ACREEDOR' | 'OTRO';

export type PrioridadCorreoHbi = 'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE';

export type ViabilidadProyectoHbi =
  | 'EN_EVALUACION'
  | 'VIABLE'
  | 'CONDICIONADO'
  | 'NO_VIABLE';

/** Registro de apertura/cierre por fase del workflow. */
export interface RegistroFaseHbi {
  fase: FaseWorkflowHbi;
  titulo: string;
  abiertaEn: string;
  cerradaEn?: string;
  abiertaPor?: string;
  notas?: string;
}

export interface AsesorFinanciacionHbi {
  nombre: string;
  entidad?: string;
  email?: string;
  telefono?: string;
}

/** Partes del crédito sindicado y quién estructuró/otorgó. */
export interface PartesCreditoHbi {
  /** Líder del sindicato o banco agente acreedor */
  otorgadoPor?: string;
  fechaAperturaCredito?: string;
  asesor?: AsesorFinanciacionHbi;
}

/** Ficha de proyecto y responsable — captura en Fase 2 (correos / viabilidad). */
export interface InfoProyectoHbi {
  responsableNombre: string;
  responsableCargo?: string;
  responsableEmail?: string;
  responsableTelefono?: string;
  sector?: string;
  ubicacion?: string;
  descripcionProyecto?: string;
  viabilidad: ViabilidadProyectoHbi;
  notasViabilidad?: string;
  actualizadoEn?: string;
}

export type EstadoActividadHbi =
  | 'PENDIENTE'
  | 'EN_PROGRESO'
  | 'COMPLETADA'
  | 'BLOQUEADA'
  | 'CANCELADA';

export interface OperacionCredito {
  id: string;
  codigoOperacion: string;
  nombreCredito: string;
  descripcion?: string;
  deudor?: string;
  agenteFinanciacion: string;
  faseActual: FaseWorkflowHbi;
  serviciosActivos: TipoServicioHbi[];
  responsableId?: string;
  creadoPor: string;
  metadata: Record<string, unknown>;
  alertasActivas: boolean;
  proximosPasos?: string;
  creadoEn: string;
  actualizadoEn: string;
  cerradoEn?: string;
}

export interface DocumentoContractual {
  id: string;
  operacionId: string;
  tipoDocumento: TipoDocumentoContractual;
  nombreArchivo: string;
  mimeType?: string;
  tamanoBytes?: number;
  blobUrl?: string;
  datosExtraidos: Record<string, unknown>;
  creadoEn: string;
}

export type DireccionCorreoHbi = 'RECIBIDO' | 'ENVIADO';

export interface CorreoOperacion {
  id: string;
  operacionId: string;
  remitente: string;
  asunto: string;
  origen: OrigenCorreoHbi;
  prioridad: PrioridadCorreoHbi;
  leido: boolean;
  recibidoEn: string;
  direccion?: DireccionCorreoHbi;
  destinatarioPrincipal?: string;
  cuerpoResumen?: string;
  correoEnviadoId?: string;
}

export interface CorreoEnviadoHbi {
  id: string;
  operacionId: string | null;
  codigoOperacion: string | null;
  tipo: string;
  estado: 'enviado' | 'fallido';
  destinatarioEmail: string;
  remitente: string | null;
  asunto: string;
  cuerpoTexto: string | null;
  mensajeError: string | null;
  creadoEn: string;
}

export type TipoEventoTrazabilidad =
  | 'HISTORIAL'
  | 'DOCUMENTO'
  | 'CORREO_RECIBIDO'
  | 'CORREO_ENVIADO'
  | 'ACTIVIDAD'
  | 'CAMBIO_FASE';

export interface EventoTrazabilidad {
  id: string;
  tipo: TipoEventoTrazabilidad;
  titulo: string;
  descripcion?: string;
  usuarioNombre?: string;
  tipoServicio?: TipoServicioHbi;
  detalle?: Record<string, unknown>;
  creadoEn: string;
}

export interface ActividadServicio {
  id: string;
  operacionId: string;
  tipoServicio: TipoServicioHbi;
  titulo: string;
  descripcion?: string;
  estado: EstadoActividadHbi;
  orden: number;
  fechaLimite?: string;
  asignadoA?: string;
}

export interface ExpedienteMaestro {
  id: string;
  operacionId: string;
  resumenContractual: Record<string, unknown>;
  cronogramas: unknown[];
  responsables: unknown[];
  comunicacionesResumen?: Record<string, unknown>;
  alertas: unknown[];
  consolidadoEn?: string;
}

export interface EstadoIntegralHbi {
  faseActual: FaseWorkflowHbi;
  proximosPasos: string;
  alertasActivas: boolean;
  avanceGlobal: number;
  avancePorAnexo: Record<string, { total: number; completadas: number; porcentaje: number }>;
  requisitosFase: Array<{
    codigo: string;
    descripcion: string;
    cumplido: boolean;
    obligatorio: boolean;
  }>;
  puedeAvanzarFase: boolean;
  mensajeAvance?: string;
}

export interface OperacionVista360 extends OperacionCredito {
  documentos: DocumentoContractual[];
  correos: CorreoOperacion[];
  expediente?: ExpedienteMaestro;
  actividades: ActividadServicio[];
  historialReciente: Array<{
    tipoEvento: string;
    comentario?: string;
    creadoEn: string;
  }>;
}

export const FASES_WORKFLOW: Array<{
  codigo: FaseWorkflowHbi;
  titulo: string;
  descripcion: string;
}> = [
  {
    codigo: 'FASE_1_CONTRATOS',
    titulo: 'Fase 1 — Ingreso de contratos',
    descripcion:
      'Cargar y clasificar la base contractual; identificar Anexos 1, 2 y 3; extraer información clave por crédito.',
  },
  {
    codigo: 'FASE_2_CORREOS',
    titulo: 'Fase 2 — Registro de correos',
    descripcion:
      'Bandeja única por operación: Agente–HBI, Deudor y Acreedores; remitente, tema y prioridad.',
  },
  {
    codigo: 'FASE_3_EXPEDIENTE',
    titulo: 'Fase 3 — Expediente maestro',
    descripcion:
      'Vista 360: data contractual, cronogramas, comunicaciones, responsables y alertas.',
  },
  {
    codigo: 'FASE_4_SEGUIMIENTO',
    titulo: 'Fase 4 — Seguimiento de actividades',
    descripcion:
      'Motor operativo recurrente por servicio (Anexos 1, 2 y 3); estado, avance y próximos pasos.',
  },
];

export const TIPOS_SERVICIO_LABEL: Record<TipoServicioHbi, string> = {
  ANEXO_1_ADMINISTRATIVO: 'Agente Administrativo (Anexo 1)',
  ANEXO_2_GARANTIAS: 'Agente de Garantías (Anexo 2)',
  ANEXO_3_CALCULO: 'Agente de Cálculo (Anexo 3)',
};

/** Rol de HBI como agente de financiación en créditos sindicados. */
export const AGENTE_FINANCIACION_HBI =
  'Agente de Financiación — créditos sindicados (Anexos 1, 2 y 3)';
