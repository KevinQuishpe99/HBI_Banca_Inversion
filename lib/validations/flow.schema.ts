import { z } from 'zod';

export const approveStepSchema = z.object({
  caseId: z.string().uuid('ID de trámite inválido'),
  comments: z.string().optional(),
});

export const legalCompleteEarlySchema = z.object({
  caseId: z.string().uuid('ID de trámite inválido'),
  comments: z.string().optional(),
});

export const rejectStepSchema = z.object({
  caseId: z.string().uuid('ID de trámite inválido'),
  comments: z.string().min(10, 'Debe proporcionar un motivo de rechazo (mínimo 10 caracteres)'),
});

const returnCaseBase = z.object({
  caseId: z.string().uuid('ID de trámite inválido'),
  returnReason: z.string().min(10, 'Debe especificar el motivo de devolución (mínimo 10 caracteres)'),
  /** Si es true, el solicitante podrá eliminar o reemplazar archivos que no sean iniciales */
  allowFileUpdate: z.boolean().optional().default(false),
});

export const returnCaseSchema = z
  .object({
    ...returnCaseBase.shape,
    /** Legal usa campos propios; el resto de áreas usa `comments` detallados */
    variant: z.enum(['standard', 'legal']).default('standard'),
    comments: z.string().optional(),
    legalObservations: z.string().optional(),
    legalClientRecommendations: z.string().optional(),
    /** Solo área Legal: marcar si debe agendarse reunión */
    legalScheduleMeeting: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.variant === 'standard') {
      if (!data.comments || data.comments.trim().length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Debe proporcionar comentarios detallados (mínimo 10 caracteres)',
          path: ['comments'],
        });
      }
    }
  });

export type ApproveStepInput = z.infer<typeof approveStepSchema>;
export type RejectStepInput = z.infer<typeof rejectStepSchema>;
export type ReturnCaseInput = z.infer<typeof returnCaseSchema>;
