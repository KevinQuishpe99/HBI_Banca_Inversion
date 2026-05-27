import { z } from 'zod';

/** Inicio del día local (comparación de calendario sin depender del offset ISO de Zod) */
function startOfLocalDay(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return x;
}

/** Acepta ISO desde el servidor o `YYYY-MM-DD` / Date; evita el modo estricto de `z.string().datetime()` */
const dateField = z
  .union([z.string().min(1, 'Requerido'), z.date()])
  .refine(
    (val) => {
      const d = val instanceof Date ? val : new Date(val);
      return !Number.isNaN(d.getTime());
    },
    { message: 'Fecha inválida' }
  )
  .transform((val) => (val instanceof Date ? val : new Date(val)));

export const createCaseSchema = z.object({
  title: z.string().min(3, 'El título debe tener al menos 3 caracteres').max(255),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional().transform((val) => (val ? new Date(val) : undefined)),
  /** Reservado; las áreas las asigna supervisión, no el formulario de creación. */
  reviewAreas: z.array(z.string().min(1)).default([]),
  // Campos del formulario de revisión legal
  advisorName: z.string().min(3, 'El nombre del asesor es requerido').optional(),
  documentFileName: z
    .string()
    .min(3, 'El nombre del archivo es requerido')
    .max(8000, 'La lista de nombres de archivos es demasiado larga (máximo 8000 caracteres)')
    .optional(),
  odooCode: z.string().max(6, 'El código Odoo debe tener máximo 6 caracteres').regex(/^S/, 'El código Odoo debe empezar con "S"').optional().or(z.literal('')),
  clientProvider: z.string().min(3, 'El cliente/proveedor es requerido').optional(),
  documentType: z.string().min(1).optional(),
  sharepointUrl: z.string().url('Debe ser una URL válida').optional().or(z.literal('')),
  requestDate: dateField,
  requiredDeliveryDate: dateField,
  urgencyJustification: z.string().optional(),
  signatureType: z.string().min(1).optional(),
  templateType: z.string().min(1).optional(),
  observations: z.string().optional(),
  amountApplies: z.boolean().default(false),
  amountValue: z.number().optional(),
}).superRefine((data, ctx) => {
  const today = startOfLocalDay(new Date());
  const req = startOfLocalDay(data.requestDate);
  const del = startOfLocalDay(data.requiredDeliveryDate);

  if (req < today) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['requestDate'],
      message: 'La fecha de la solicitud no puede ser anterior a hoy',
    });
  }

  if (del < today) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['requiredDeliveryDate'],
      message: 'La fecha de entrega requerida no puede ser anterior a hoy',
    });
  }

  if (del < req) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['requiredDeliveryDate'],
      message: 'La fecha de entrega requerida no puede ser anterior a la fecha de la solicitud',
    });
  }

  if (data.amountApplies) {
    if (data.amountValue == null || Number.isNaN(data.amountValue)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amountValue'],
        message: 'Ingrese el monto',
      });
    } else if (data.amountValue <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amountValue'],
        message: 'El monto debe ser mayor que cero',
      });
    }
  }
});

/** Validación estricta del formulario de creación (campos obligatorios del UI). */
export const createCaseFormSchema = createCaseSchema.superRefine((data, ctx) => {
  const advisor = data.advisorName?.trim() ?? '';
  if (advisor.length < 3) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['advisorName'],
      message: 'Indique el nombre del asesor o responsable (mínimo 3 caracteres).',
    });
  }

  const client = data.clientProvider?.trim() ?? '';
  if (client.length < 3) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['clientProvider'],
      message: 'Indique el nombre del cliente o proveedor (mínimo 3 caracteres).',
    });
  }

  if (!data.documentType?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['documentType'],
      message: 'Seleccione el tipo de documento.',
    });
  }

  if (!data.signatureType?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['signatureType'],
      message: 'Seleccione el tipo de firma.',
    });
  }

  if (!data.templateType?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['templateType'],
      message: 'Seleccione el tipo de plantilla.',
    });
  }

  const odoo = typeof data.odooCode === 'string' ? data.odooCode.trim() : '';
  if (odoo.length > 0) {
    if (!/^S/i.test(odoo)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['odooCode'],
        message: 'El código Odoo debe empezar con la letra «S».',
      });
    } else if (odoo.length > 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['odooCode'],
        message: 'El código Odoo debe tener como máximo 6 caracteres.',
      });
    }
  }
});

export const updateCaseSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['SUBMITTED', 'IN_REVIEW', 'APPROVED', 'RETURNED', 'COMPLETED']).optional(),
  dueDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  advisorName: z.string().min(3).optional(),
  documentFileName: z.string().min(3).optional(),
  odooCode: z.string().max(6).regex(/^S/, 'El código Odoo debe empezar con "S"').optional().or(z.literal('')),
  clientProvider: z.string().min(3).optional(),
  documentType: z.string().min(1).optional(),
  sharepointUrl: z.string().url().optional().or(z.literal('')),
  requestDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  requiredDeliveryDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  urgencyJustification: z.string().optional(),
  signatureType: z.string().min(1).optional(),
  templateType: z.string().min(1).optional(),
  observations: z.string().optional(),
});

export const caseIdSchema = z.object({
  id: z.string().uuid('ID de trámite inválido'),
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
