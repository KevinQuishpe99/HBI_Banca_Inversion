/** Covenant financiero / operativo (típico en créditos sindicados). */
export type EstadoCovenant = 'CUMPLE' | 'EN_RIESGO' | 'INCUMPLIDO' | 'PENDIENTE_TEST';

export interface CovenantFinanciero {
  id: string;
  operacionId: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  tipo: 'FINANCIERO' | 'OPERATIVO' | 'REPORTING' | 'ESG';
  umbral: string;
  valorActual: string;
  frecuenciaTest: 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL' | 'POR_HITO';
  proximoTest: string;
  estado: EstadoCovenant;
  anexoResponsable: 'ANEXO_1' | 'ANEXO_2' | 'ANEXO_3';
}

/** Obligación contractual con fecha límite. */
export type TipoObligacion =
  | 'REPORTE_SINDICATO'
  | 'PAGO_INTERESES'
  | 'ENTREGA_INFORMACION'
  | 'COMITE_CREDITO'
  | 'RENOVACION_GARANTIA'
  | 'DESembolso';

export interface ObligacionContractual {
  id: string;
  operacionId: string;
  titulo: string;
  tipo: TipoObligacion;
  fechaLimite: string;
  responsable: string;
  anexo: 'ANEXO_1' | 'ANEXO_2' | 'ANEXO_3' | 'HBI';
  cumplida: boolean;
  critica: boolean;
}

/** Ítem de comité de crédito / desembolso. */
export type EstadoComite = 'PENDIENTE' | 'EN_REVISION' | 'APROBADO' | 'RECHAZADO' | 'DIFERIDO';

export interface ItemComiteCredito {
  id: string;
  operacionId: string;
  titulo: string;
  tipo: 'DESembolso' | 'MODIFICACION' | 'WAIVER' | 'REESTRUCTURACION';
  montoSolicitado: number;
  moneda: 'USD' | 'COP';
  hitoId?: string;
  solicitante: string;
  fechaSesion: string;
  estado: EstadoComite;
  votosAprobacion: number;
  votosRechazo: number;
  votosAbstencion: number;
  observaciones?: string;
}

/** Reporte periódico al sindicado de acreedores. */
export interface ReporteSindicato {
  id: string;
  operacionId: string;
  periodo: string;
  generadoEn: string;
  generadoPor: string;
  resumenEjecutivo: string;
  metricas: {
    saldoVigente: number;
    desembolsado: number;
    porDesembolsar: number;
    covenantsEnRiesgo: number;
    obligacionesVencidas: number;
  };
  destinatarios: string[];
  enviado: boolean;
}

/** KPIs de cartera (portfolio). */
export interface CarteraKpis {
  operacionesActivas: number;
  montoTotalCartera: number;
  monedaPrincipal: 'USD' | 'COP';
  alertasCriticas: number;
  covenantsEnRiesgo: number;
  comitesPendientes: number;
  obligacionesProximas7Dias: number;
  desembolsosPendientesAprobacion: number;
  exposicionPorSector: Array<{ sector: string; monto: number; operaciones: number }>;
}
