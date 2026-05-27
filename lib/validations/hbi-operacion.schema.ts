import { z } from 'zod';

const tipoServicio = z.enum([
  'ANEXO_1_ADMINISTRATIVO',
  'ANEXO_2_GARANTIAS',
  'ANEXO_3_CALCULO',
]);

const tipoDocumento = z.enum([
  'CONTRATO_MARCO',
  'ANEXO_1',
  'ANEXO_2',
  'ANEXO_3',
  'CRONOGRAMA',
  'GARANTIA',
  'OTRO',
]);

export const crearOperacionSchema = z.object({
  nombreCredito: z.string().min(3, 'Indique el nombre del crédito').max(500),
  descripcion: z.string().max(5000).optional(),
  deudor: z.string().max(300).optional(),
  serviciosActivos: z.array(tipoServicio).min(1, 'Seleccione al menos un servicio (Anexo)'),
  responsableId: z.string().uuid().optional(),
});

export const avanzarFaseSchema = z.object({
  fase: z.enum([
    'FASE_1_CONTRATOS',
    'FASE_2_CORREOS',
    'FASE_3_EXPEDIENTE',
    'FASE_4_SEGUIMIENTO',
  ]),
  comentario: z.string().max(2000).optional(),
});

export const registrarCorreoSchema = z.object({
  remitente: z.string().min(3, 'Indique el remitente').max(320),
  asunto: z.string().min(1).max(1000),
  cuerpoResumen: z.string().max(10000).optional(),
  origen: z.enum(['AGENTE_HBI', 'DEUDOR', 'ACREEDOR', 'OTRO']).optional(),
  prioridad: z.enum(['BAJA', 'MEDIA', 'ALTA', 'URGENTE']).optional(),
});

export const crearActividadSchema = z.object({
  tipoServicio: tipoServicio,
  titulo: z.string().min(2).max(500),
  descripcion: z.string().max(5000).optional(),
  fechaLimite: z.string().datetime().optional(),
  asignadoA: z.string().uuid().optional(),
});

export const actualizarActividadEstadoSchema = z.object({
  estado: z.enum(['PENDIENTE', 'EN_PROGRESO', 'COMPLETADA', 'BLOQUEADA', 'CANCELADA']),
});

export const tipoDocumentoManualSchema = z.object({
  tipoDocumento: tipoDocumento.optional(),
});
