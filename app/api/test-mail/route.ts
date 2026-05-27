import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/get-session';
import { sendMailApplication } from '@/lib/email/graph-mail';
import { buildNotificationHtmlFromPlainBody } from '@/lib/email/transactional-html';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ValidationError } from '@/lib/utils/errors';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  /** Destinatario; si no se envía, se usa el correo del admin que llama la API. */
  to: z.string().email().optional(),
});

/**
 * POST /api/test-mail
 * Solo ADMIN. Envía un correo de prueba vía Microsoft Graph (Mail.Send aplicación).
 *
 * Body JSON opcional: { "to": "destino@dominio.com" }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole('ADMIN');
    let to: string | undefined;
    try {
      const json = await request.json();
      const parsed = bodySchema.parse(json);
      to = parsed.to;
    } catch {
      to = undefined;
    }
    const recipient = to ?? session.user.email;
    if (!recipient) {
      throw new ValidationError(
        'No hay correo destino: indique "to" en el body o use un usuario con email en sesión.'
      );
    }

    const bodyText = [
      'Correo de prueba del Sistema de Gestión Documental de COMWARE (Microsoft Graph).',
      '',
      `Destinatario: ${recipient}`,
      `Fecha (UTC): ${new Date().toISOString()}`,
      '',
      'Remitente: valor configurado en MAIL_FROM_ADDRESS.',
      '',
      '────────────────────────────────────────',
      'Mensaje generado automáticamente; no requiere respuesta.',
    ].join('\n');

    await sendMailApplication({
      to: recipient,
      subject: '[COMWARE] Sistema de Gestión Documental — Prueba técnica (Graph)',
      bodyText,
      bodyHtml: buildNotificationHtmlFromPlainBody(bodyText),
      logMeta: {
        tipo: 'TEST_MAIL',
        destinatarioUsuarioId: session.user.id,
      },
    });

    return successResponse({
      ok: true,
      message: 'Correo de prueba enviado.',
      to: recipient,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
