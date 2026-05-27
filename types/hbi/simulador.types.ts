/** Parámetros de entrada del simulador Anexo 3. */
export interface ParametrosSimuladorHbi {
  montoTotal: number;
  desembolsado: number;
  moneda: 'USD' | 'COP';
  tasaReferenciaPct: number;
  spreadBps: number;
  plazoAnios: number;
  ebitdaAnual: number;
  /** Meses de retraso en ingresos (escenario stress). */
  mesesRetraso: number;
}

/** Resultado de un escenario calculado. */
export interface ResultadoEscenarioHbi {
  id: 'BASE' | 'TASA_UP' | 'EBITDA_DOWN' | 'RETRASO';
  nombre: string;
  descripcion: string;
  tasaEfectivaPct: number;
  ebitdaUsado: number;
  saldoVigente: number;
  servicioDeudaAnual: number;
  dscr: number;
  leverage: number;
  llcr: number;
  cumpleDscr: boolean;
  cumpleLeverage: boolean;
  cumpleLlcr: boolean;
  semaforo: 'VERDE' | 'AMBAR' | 'ROJO';
}

export const UMBRALES_COVENANT = {
  dscrMin: 1.2,
  leverageMax: 4.5,
  llcrMin: 1.15,
} as const;
