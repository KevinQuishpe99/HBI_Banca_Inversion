import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/get-session';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ForbiddenError } from '@/lib/utils/errors';
import { WIPE_TRAMITES_CONFIRM_PHRASE } from '@/lib/constants/dev-wipe';
import { DevWipeService } from '@/services/dev-wipe.service';

function wipeAllowed(): boolean {
  return process.env.ALLOW_DEV_DATA_WIPE === 'true';
}

/**
 * GET: indica si la eliminación de datos por API está habilitada (solo admin).
 */
export async function GET() {
  try {
    await requireRole('ADMIN');
    return successResponse({ enabled: wipeAllowed() });
  } catch (error) {
    return errorResponse(error);
  }
}

const postSchema = z.object({
  confirmPhrase: z.literal(WIPE_TRAMITES_CONFIRM_PHRASE),
});

/**
 * POST: borra todos los trámites y archivos ligados (requiere ALLOW_DEV_DATA_WIPE=true y frase exacta).
 */
export async function POST(request: NextRequest) {
  try {
    await requireRole('ADMIN');
    if (!wipeAllowed()) {
      throw new ForbiddenError('La eliminación de datos por API no está habilitada en el servidor.');
    }
    const body = await request.json();
    postSchema.parse(body);
    await DevWipeService.wipeTramitesYArchivos();
    return successResponse({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
