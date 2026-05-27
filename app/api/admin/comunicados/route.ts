import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/get-session';
import { getMailConfigStatus } from '@/lib/email/mail-config-status';
import { sendAdminComunicado } from '@/services/admin-comunicados.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ValidationError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z
  .object({
    audience: z.enum(['all', 'selected']),
    userIds: z.array(z.string().uuid()).optional(),
    subject: z.string().min(3, 'El asunto debe tener al menos 3 caracteres.').max(200),
    message: z.string().min(10, 'El mensaje debe tener al menos 10 caracteres.').max(8000),
  })
  .superRefine((data, ctx) => {
    if (data.audience === 'selected' && (!data.userIds || data.userIds.length === 0)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Seleccione al menos un usuario.',
        path: ['userIds'],
      });
    }
  });

/**
 * POST /api/admin/comunicados
 */
export async function POST(request: NextRequest) {
  try {
    await requireRole('ADMIN');
    const mail = getMailConfigStatus();
    if (!mail.ready) {
      throw new ValidationError(
        'El envío de correos no está configurado. Revise la pestaña Configuración.'
      );
    }

    const json = await request.json();
    const body = bodySchema.parse(json);
    const result = await sendAdminComunicado({
      audience: body.audience,
      userIds: body.userIds,
      subject: body.subject,
      message: body.message,
    });

    return successResponse({
      message:
        result.failed === 0
          ? `Comunicado enviado a ${result.sent} destinatario(s).`
          : `Enviado a ${result.sent} de ${result.total}. ${result.failed} fallo(s).`,
      ...result,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
