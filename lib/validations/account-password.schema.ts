import { z } from 'zod';

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres'),
    confirmPassword: z.string().min(1, 'Confirme la nueva contraseña'),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Las contraseñas no coinciden',
      });
    }
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
