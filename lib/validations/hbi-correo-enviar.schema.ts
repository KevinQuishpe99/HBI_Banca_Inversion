import { z } from 'zod';

export const enviarCorreoHbiSchema = z.object({
  destinatarioEmail: z.string().email('Correo destinatario inválido'),
  asunto: z.string().min(1, 'Indique el asunto').max(900),
  cuerpoTexto: z.string().min(1, 'Indique el cuerpo del mensaje').max(15000),
  origen: z.enum(['AGENTE_HBI', 'DEUDOR', 'ACREEDOR', 'OTRO']).optional(),
});
