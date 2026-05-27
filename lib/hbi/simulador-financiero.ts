import type {
  ParametrosSimuladorHbi,
  ResultadoEscenarioHbi,
} from '@/types/hbi/simulador.types';
import { UMBRALES_COVENANT } from '@/types/hbi/simulador.types';

function calcularEscenario(
  id: ResultadoEscenarioHbi['id'],
  nombre: string,
  descripcion: string,
  params: ParametrosSimuladorHbi,
  ajustes: { extraBps?: number; factorEbitda?: number; factorSaldo?: number }
): ResultadoEscenarioHbi {
  const tasaEfectivaPct =
    params.tasaReferenciaPct + params.spreadBps / 100 + (ajustes.extraBps ?? 0) / 100;
  const tasa = tasaEfectivaPct / 100;
  const ebitdaUsado = params.ebitdaAnual * (ajustes.factorEbitda ?? 1);
  const saldoVigente = Math.max(
    params.desembolsado * (ajustes.factorSaldo ?? 1),
    params.montoTotal * 0.15
  );
  const interesAnual = saldoVigente * tasa;
  const amortizacion = params.montoTotal / Math.max(params.plazoAnios, 1);
  const servicioDeudaAnual = interesAnual + amortizacion;
  const dscr = servicioDeudaAnual > 0 ? ebitdaUsado / servicioDeudaAnual : 0;
  const leverage = ebitdaUsado > 0 ? saldoVigente / ebitdaUsado : 99;
  const flujoDescontado = ebitdaUsado * params.plazoAnios * 0.85;
  const llcr = saldoVigente > 0 ? flujoDescontado / saldoVigente : 0;

  const cumpleDscr = dscr >= UMBRALES_COVENANT.dscrMin;
  const cumpleLeverage = leverage <= UMBRALES_COVENANT.leverageMax;
  const cumpleLlcr = llcr >= UMBRALES_COVENANT.llcrMin;

  let semaforo: ResultadoEscenarioHbi['semaforo'] = 'VERDE';
  if (!cumpleDscr || !cumpleLeverage || !cumpleLlcr) {
    semaforo = !cumpleDscr && !cumpleLlcr ? 'ROJO' : 'AMBAR';
  }

  return {
    id,
    nombre,
    descripcion,
    tasaEfectivaPct,
    ebitdaUsado,
    saldoVigente,
    servicioDeudaAnual,
    dscr,
    leverage,
    llcr,
    cumpleDscr,
    cumpleLeverage,
    cumpleLlcr,
    semaforo,
  };
}

/** Calcula escenario base y tres stress tests típicos de comité de crédito. */
export function calcularEscenariosSimulador(params: ParametrosSimuladorHbi): ResultadoEscenarioHbi[] {
  const factorRetraso = Math.max(0.55, 1 - params.mesesRetraso * 0.04);

  return [
    calcularEscenario(
      'BASE',
      'Escenario base',
      'Condiciones contractuales actuales según modelo financiero del deudor.',
      params,
      {}
    ),
    calcularEscenario(
      'TASA_UP',
      'Tasa +100 bps',
      'Stress de mercado: subida de 100 puntos base sobre SOFR + spread.',
      params,
      { extraBps: 100 }
    ),
    calcularEscenario(
      'EBITDA_DOWN',
      'EBITDA −15%',
      'Caída de flujo operativo por retraso de ingresos o menor demanda.',
      params,
      { factorEbitda: 0.85 }
    ),
    calcularEscenario(
      'RETRASO',
      `Retraso ${params.mesesRetraso} meses`,
      'Proyecto con ingresos diferidos: menor EBITDA y mayor saldo pendiente de desembolso.',
      params,
      { factorEbitda: factorRetraso, factorSaldo: 1.08 }
    ),
  ];
}

export function parametrosDesdeOperacion(metadata: Record<string, unknown> | undefined): ParametrosSimuladorHbi {
  const estructura = metadata?.estructuraFinanciera as
    | { montoTotal?: number; moneda?: 'USD' | 'COP' }
    | undefined;
  const hitos = (metadata?.hitosDesembolso ?? []) as Array<{
    aprobado?: boolean;
    monto?: number;
    montoAprobado?: number;
    estado?: string;
  }>;

  const montoTotal = estructura?.montoTotal ?? 180_000_000;
  const desembolsado = hitos
    .filter((h) => h.aprobado || h.estado === 'COMPLETADO')
    .reduce((acc, h) => acc + (h.montoAprobado ?? h.monto ?? 0), 0);

  const escala = montoTotal > 50_000_000 ? 1 : montoTotal / 180_000_000;

  return {
    montoTotal,
    desembolsado: desembolsado || montoTotal * 0.2,
    moneda: estructura?.moneda ?? 'USD',
    tasaReferenciaPct: 4.25,
    spreadBps: 275,
    plazoAnios: 12,
    ebitdaAnual: Math.round(42_000_000 * Math.max(escala, 0.3)),
    mesesRetraso: 6,
  };
}

export function formatearRatio(valor: number, decimales = 2): string {
  return `${valor.toFixed(decimales)}x`;
}
