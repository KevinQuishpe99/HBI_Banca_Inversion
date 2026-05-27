import type {
  CorreoOperacion,
  DocumentoContractual,
  TipoServicioHbi,
} from '@/types/hbi/operacion.types';

/** Consolida expediente maestro desde el primer momento (documento PDF). */
export function construirResumenExpediente(input: {
  codigoOperacion: string;
  nombreCredito: string;
  deudor?: string;
  documentos: DocumentoContractual[];
  correos: CorreoOperacion[];
  serviciosActivos: TipoServicioHbi[];
}): {
  resumenContractual: Record<string, unknown>;
  cronogramas: unknown[];
  responsables: unknown[];
  comunicacionesResumen: Record<string, unknown>;
  alertas: Array<{ tipo: string; mensaje: string; severidad: string }>;
} {
  const porTipo = input.documentos.reduce<Record<string, number>>((acc, d) => {
    acc[d.tipoDocumento] = (acc[d.tipoDocumento] ?? 0) + 1;
    return acc;
  }, {});

  const cronogramas = input.documentos
    .filter((d) => d.tipoDocumento === 'CRONOGRAMA')
    .map((d) => ({
      fuente: d.nombreArchivo,
      datos: d.datosExtraidos,
      idDocumento: d.id,
    }));

  const correosPorOrigen = input.correos.reduce<Record<string, number>>((acc, c) => {
    acc[c.origen] = (acc[c.origen] ?? 0) + 1;
    return acc;
  }, {});

  const alertas: Array<{ tipo: string; mensaje: string; severidad: string }> = [];
  const urgentes = input.correos.filter((c) => c.prioridad === 'URGENTE' && !c.leido);
  if (urgentes.length > 0) {
    alertas.push({
      tipo: 'CORREO_URGENTE',
      mensaje: `${urgentes.length} correo(s) urgente(s) sin leer`,
      severidad: 'alta',
    });
  }
  if (!input.documentos.some((d) => d.tipoDocumento === 'CONTRATO_MARCO')) {
    alertas.push({
      tipo: 'DOC_MARCO',
      mensaje: 'Falta contrato marco en el paquete contractual',
      severidad: 'media',
    });
  }

  return {
    resumenContractual: {
      codigoOperacion: input.codigoOperacion,
      nombreCredito: input.nombreCredito,
      deudor: input.deudor ?? null,
      paqueteDocumentos: porTipo,
      totalDocumentos: input.documentos.length,
      serviciosActivos: input.serviciosActivos,
      ultimaActualizacion: new Date().toISOString(),
    },
    cronogramas,
    responsables: [],
    comunicacionesResumen: {
      totalCorreos: input.correos.length,
      porOrigen: correosPorOrigen,
      ultimoCorreo: input.correos[0]?.recibidoEn ?? null,
    },
    alertas,
  };
}
