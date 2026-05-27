/** Cliente del catálogo demo (deudor o acreedor sindicado). */
export type TipoClienteHbi = 'DEUDOR' | 'ACREEDOR';

export interface ClienteCatalogoHbi {
  id: string;
  tipo: TipoClienteHbi;
  razonSocial: string;
  nit: string;
  pais: string;
  sector: string;
  contacto: string;
  email: string;
}

/** Participación de un acreedor en la operación. */
export interface ParticipacionAcreedor {
  id: string;
  razonSocial: string;
  porcentaje: number;
  montoComprometido: number;
}

/** Evidencia documental para habilitar un desembolso. */
export interface EvidenciaDesembolsoHbi {
  id: string;
  nombreArchivo: string;
  anexoRequerido: 'ANEXO_1' | 'ANEXO_2' | 'ANEXO_3';
  descripcion?: string;
  subidoEn: string;
}

export interface ChecklistItemHito {
  item: string;
  cumplido: boolean;
  anexo: 'ANEXO_1' | 'ANEXO_2' | 'ANEXO_3' | 'HBI';
  requiereArchivo?: boolean;
}

/** Hito de desembolso con monto aprobado por fase. */
export interface HitoDesembolsoHbi {
  id: string;
  nombre: string;
  porcentaje: number;
  monto: number;
  montoAprobado: number;
  aprobado: boolean;
  estado: 'PENDIENTE' | 'PENDIENTE_APROBACION' | 'EN_REVISION' | 'APROBADO' | 'COMPLETADO';
  fechaObjetivo: string;
  /** Descripción de qué ocurre en el proyecto en esta fase. */
  descripcionFase?: string;
  /** Código de fase del proyecto (pre-construcción, obra, operación…). */
  faseProyecto?: string;
  /** Fecha real en que se ejecutó el desembolso. */
  fechaDesembolsoEjecutado?: string | null;
  /** Archivos de evidencia por Anexo 1, 2 y 3. */
  evidencias?: EvidenciaDesembolsoHbi[];
  checklistDocumental: ChecklistItemHito[];
}

export interface EstructuraFinancieraHbi {
  montoTotal: number;
  moneda: 'USD' | 'COP';
  acreedores: ParticipacionAcreedor[];
  montoComprometidoTotal: number;
}

export type TipoCreditoHbi =
  | 'PROJECT_FINANCE'
  | 'CORPORATIVO'
  | 'INFRAESTRUCTURA'
  | 'REFINANCIACION';

export const TIPO_CREDITO_LABEL: Record<TipoCreditoHbi, string> = {
  PROJECT_FINANCE: 'Project Finance (por hitos)',
  CORPORATIVO: 'Crédito corporativo sindicado',
  INFRAESTRUCTURA: 'Infraestructura / concesión',
  REFINANCIACION: 'Refinanciación / reestructuración',
};
