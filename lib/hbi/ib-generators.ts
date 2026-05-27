import type { OperacionCredito } from '@/types/hbi/operacion.types';
import type {
  CovenantFinanciero,
  ItemComiteCredito,
  ObligacionContractual,
} from '@/types/hbi/ib-avanzado.types';
import type { HitoDesembolsoHbi } from '@/types/hbi/cliente.types';

function diasDesdeHoy(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

function monedaOp(op: OperacionCredito): 'USD' | 'COP' {
  const e = op.metadata?.estructuraFinanciera as { moneda?: 'USD' | 'COP' } | undefined;
  return e?.moneda ?? 'USD';
}

function montoOp(op: OperacionCredito): number {
  const e = op.metadata?.estructuraFinanciera as { montoTotal?: number } | undefined;
  return e?.montoTotal ?? 50_000_000;
}

export function generarCovenantsOperacion(
  operacionId: string,
  seq: { next: () => number }
): CovenantFinanciero[] {
  const id = () => `cov-${operacionId}-${seq.next()}`;
  return [
    {
      id: id(),
      operacionId,
      codigo: 'COV-DSCR',
      nombre: 'Debt Service Coverage Ratio (DSCR)',
      descripcion: 'Cobertura mínima del servicio de la deuda vs flujo de caja del proyecto.',
      tipo: 'FINANCIERO',
      umbral: '≥ 1.20x',
      valorActual: '1.34x',
      frecuenciaTest: 'TRIMESTRAL',
      proximoTest: diasDesdeHoy(18),
      estado: 'CUMPLE',
      anexoResponsable: 'ANEXO_3',
    },
    {
      id: id(),
      operacionId,
      codigo: 'COV-LEVERAGE',
      nombre: 'Leverage ratio (Deuda / EBITDA)',
      descripcion: 'Relación de apalancamiento máxima permitida por el contrato marco.',
      tipo: 'FINANCIERO',
      umbral: '≤ 4.50x',
      valorActual: '4.12x',
      frecuenciaTest: 'TRIMESTRAL',
      proximoTest: diasDesdeHoy(18),
      estado: 'CUMPLE',
      anexoResponsable: 'ANEXO_3',
    },
    {
      id: id(),
      operacionId,
      codigo: 'COV-LLCR',
      nombre: 'Loan Life Coverage Ratio (LLCR)',
      descripcion: 'Cobertura del flujo descontado sobre saldo de deuda a vida del crédito.',
      tipo: 'FINANCIERO',
      umbral: '≥ 1.15x',
      valorActual: '1.08x',
      frecuenciaTest: 'SEMESTRAL',
      proximoTest: diasDesdeHoy(45),
      estado: 'EN_RIESGO',
      anexoResponsable: 'ANEXO_3',
    },
    {
      id: id(),
      operacionId,
      codigo: 'COV-REPORT',
      nombre: 'Reporte financiero auditado',
      descripcion: 'Entrega de estados financieros auditados dentro de 120 días del cierre.',
      tipo: 'REPORTING',
      umbral: '120 días post cierre',
      valorActual: 'En preparación',
      frecuenciaTest: 'ANUAL',
      proximoTest: diasDesdeHoy(60),
      estado: 'PENDIENTE_TEST',
      anexoResponsable: 'ANEXO_1',
    },
    {
      id: id(),
      operacionId,
      codigo: 'COV-ESG',
      nombre: 'Indicadores ESG / sostenibilidad',
      descripcion: 'Reporte anual de métricas ambientales y sociales del proyecto.',
      tipo: 'ESG',
      umbral: '100% indicadores reportados',
      valorActual: '92%',
      frecuenciaTest: 'ANUAL',
      proximoTest: diasDesdeHoy(90),
      estado: 'CUMPLE',
      anexoResponsable: 'ANEXO_1',
    },
    {
      id: id(),
      operacionId,
      codigo: 'COV-GAR',
      nombre: 'Garantías vigentes',
      descripcion: 'Pólizas y fiducias sin vencimiento ni gaps de cobertura.',
      tipo: 'OPERATIVO',
      umbral: '100% vigentes',
      valorActual: '1 póliza vence en 15 días',
      frecuenciaTest: 'TRIMESTRAL',
      proximoTest: diasDesdeHoy(15),
      estado: 'EN_RIESGO',
      anexoResponsable: 'ANEXO_2',
    },
  ];
}

export function generarObligacionesOperacion(
  op: OperacionCredito,
  seq: { next: () => number }
): ObligacionContractual[] {
  const id = () => `obl-${op.id}-${seq.next()}`;
  const hitos = (op.metadata?.hitosDesembolso ?? []) as HitoDesembolsoHbi[];
  const base: ObligacionContractual[] = [
    {
      id: id(),
      operacionId: op.id,
      titulo: 'Reporte trimestral al sindicado de acreedores',
      tipo: 'REPORTE_SINDICATO',
      fechaLimite: diasDesdeHoy(12),
      responsable: 'María González (Anexo 1)',
      anexo: 'ANEXO_1',
      cumplida: false,
      critica: true,
    },
    {
      id: id(),
      operacionId: op.id,
      titulo: 'Pago de intereses periodo Q2',
      tipo: 'PAGO_INTERESES',
      fechaLimite: diasDesdeHoy(25),
      responsable: 'Ana Torres (Anexo 3)',
      anexo: 'ANEXO_3',
      cumplida: false,
      critica: true,
    },
    {
      id: id(),
      operacionId: op.id,
      titulo: 'Renovación póliza de cumplimiento',
      tipo: 'RENOVACION_GARANTIA',
      fechaLimite: diasDesdeHoy(15),
      responsable: 'Carlos Ruiz (Anexo 2)',
      anexo: 'ANEXO_2',
      cumplida: false,
      critica: true,
    },
    {
      id: id(),
      operacionId: op.id,
      titulo: 'Entrega modelo financiero actualizado',
      tipo: 'ENTREGA_INFORMACION',
      fechaLimite: diasDesdeHoy(30),
      responsable: 'Deudor / HBI',
      anexo: 'ANEXO_3',
      cumplida: false,
      critica: false,
    },
  ];

  for (const h of hitos.slice(0, 2)) {
    base.push({
      id: id(),
      operacionId: op.id,
      titulo: `Comité de crédito — desembolso ${h.id}`,
      tipo: 'COMITE_CREDITO',
      fechaLimite: h.fechaObjetivo,
      responsable: 'Comité acreedores + HBI',
      anexo: 'HBI',
      cumplida: h.aprobado === true,
      critica: true,
    });
  }
  return base;
}

export function generarComiteOperacion(
  op: OperacionCredito,
  seq: { next: () => number }
): ItemComiteCredito[] {
  const moneda = monedaOp(op);
  const monto = montoOp(op);
  const hitos = (op.metadata?.hitosDesembolso ?? []) as HitoDesembolsoHbi[];
  const id = () => `com-${op.id}-${seq.next()}`;

  const items: ItemComiteCredito[] = [];

  if (hitos.length > 0) {
    const h1 = hitos[0];
    items.push({
      id: id(),
      operacionId: op.id,
      titulo: `Autorización desembolso ${h1.id} — ${h1.nombre}`,
      tipo: 'DESembolso',
      montoSolicitado: h1.montoAprobado || h1.monto,
      moneda,
      hitoId: h1.id,
      solicitante: op.deudor ?? 'Deudor',
      fechaSesion: diasDesdeHoy(5),
      estado: h1.aprobado ? 'APROBADO' : 'PENDIENTE',
      votosAprobacion: h1.aprobado ? 5 : 0,
      votosRechazo: 0,
      votosAbstencion: h1.aprobado ? 0 : 0,
      observaciones: h1.aprobado
        ? 'Aprobado por unanimidad con checklist documental completo.'
        : 'Pendiente certificación Anexo 2 y recálculo Anexo 3.',
    });
  }

  if (hitos.length > 1) {
    const h2 = hitos[1];
    items.push({
      id: id(),
      operacionId: op.id,
      titulo: `Desembolso ${h2.id} — ${h2.nombre}`,
      tipo: 'DESembolso',
      montoSolicitado: h2.monto,
      moneda,
      hitoId: h2.id,
      solicitante: op.deudor ?? 'Deudor',
      fechaSesion: h2.fechaObjetivo,
      estado: 'EN_REVISION',
      votosAprobacion: 2,
      votosRechazo: 0,
      votosAbstencion: 1,
      observaciones: 'En revisión: falta acta de inicio de obra y cronograma recalculado.',
    });
  }

  items.push({
    id: id(),
    operacionId: op.id,
    titulo: 'Waiver covenant LLCR (temporal 90 días)',
    tipo: 'WAIVER',
    montoSolicitado: 0,
    moneda,
    solicitante: op.deudor ?? 'Deudor',
    fechaSesion: diasDesdeHoy(8),
    estado: 'PENDIENTE',
    votosAprobacion: 0,
    votosRechazo: 0,
    votosAbstencion: 0,
    observaciones: 'Solicitud por retraso en certificación de ingresos del periodo.',
  });

  if (monto > 100_000_000) {
    items.push({
      id: id(),
      operacionId: op.id,
      titulo: 'Modificación spread +25 bps por riesgo sectorial',
      tipo: 'MODIFICACION',
      montoSolicitado: Math.round(monto * 0.0025),
      moneda,
      solicitante: 'Agente HBI',
      fechaSesion: diasDesdeHoy(20),
      estado: 'DIFERIDO',
      votosAprobacion: 0,
      votosRechazo: 0,
      votosAbstencion: 0,
    });
  }

  return items;
}
