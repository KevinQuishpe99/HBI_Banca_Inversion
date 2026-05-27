import type { TipoServicioHbi } from '@/types/hbi/operacion.types';

/** Guía institucional de anexos HBI para el formulario de alta. */
export const GUIA_ANEXOS: Array<{
  codigo: TipoServicioHbi;
  titulo: string;
  resumen: string;
  responsabilidades: string[];
  documentosClave: string[];
  fasesRelacionadas: string[];
}> = [
  {
    codigo: 'ANEXO_1_ADMINISTRATIVO',
    titulo: 'Agente Administrativo (Anexo 1)',
    resumen:
      'HBI administra el crédito sindicado: desembolsos por hitos, reportes al comité de acreedores, comunicación con deudor y registro de condiciones precedentes.',
    responsabilidades: [
      'Validar checklist documental antes de cada desembolso',
      'Coordinar actas de comité y autorizaciones de monto por fase',
      'Llevar el calendario de obligaciones del deudor',
      'Reportar incumplimientos contractuales al sindicato',
    ],
    documentosClave: ['Contrato marco', 'Acta de comité', 'Certificados de cumplimiento', 'Solicitudes de desembolso'],
    fasesRelacionadas: ['Fase 1 — Contratos', 'Fase 2 — Correos', 'Fase 4 — Seguimiento'],
  },
  {
    codigo: 'ANEXO_2_GARANTIAS',
    titulo: 'Agente de Garantías (Anexo 2)',
    resumen:
      'Control de garantías reales y personales, pólizas, fiducias y liberaciones condicionadas al avance del proyecto y cumplimiento de ratios.',
    responsabilidades: [
      'Monitorear vigencia de pólizas y garantías mobiliarias/inmobiliarias',
      'Certificar cumplimiento antes de liberar montos retenidos',
      'Alertar vencimientos y renovaciones al agente administrativo',
      'Actualizar el registro de garantías en el expediente 360',
    ],
    documentosClave: ['Pólizas de cumplimiento', 'Contratos de fiducia', 'Certificaciones de garantía', 'Endosos'],
    fasesRelacionadas: ['Fase 1 — Contratos', 'Fase 3 — Expediente', 'Fase 4 — Seguimiento'],
  },
  {
    codigo: 'ANEXO_3_CALCULO',
    titulo: 'Agente de Cálculo (Anexo 3)',
    resumen:
      'Validación de cronogramas, tasas (SOFR, IBR, etc.), cuotas, comisiones y escenarios de prepago o recálculo solicitados por acreedores.',
    responsabilidades: [
      'Recalcular cuotas ante cambios de tasa o amortizaciones extraordinarias',
      'Conciliar saldos con el deudor y el sindicado',
      'Emitir certificaciones de deuda para desembolsos y pagos',
      'Soportar escenarios de stress para comité de crédito',
    ],
    documentosClave: ['Cronograma base', 'Modelo financiero', 'Certificación de saldos', 'Carta de tasas'],
    fasesRelacionadas: ['Fase 1 — Contratos', 'Fase 3 — Expediente', 'Fase 4 — Seguimiento'],
  },
];

export const GUIA_FASES_WORKFLOW = [
  {
    fase: '1',
    titulo: 'Ingreso de contratos',
    texto: 'Se carga el paquete contractual, se identifican Anexos 1–3 y se extrae la data clave del crédito.',
  },
  {
    fase: '2',
    titulo: 'Canal de comunicaciones',
    texto: 'Bandeja única: correos de HBI, deudor y acreedores con trazabilidad por operación.',
  },
  {
    fase: '3',
    titulo: 'Expediente maestro 360',
    texto: 'Vista consolidada: partes, montos, cronogramas, garantías y alertas.',
  },
  {
    fase: '4',
    titulo: 'Seguimiento por anexos',
    texto: 'Motor operativo recurrente: actividades, checklist por hito y aprobación de montos por fase.',
  },
] as const;
