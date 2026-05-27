import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/get-session';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ForbiddenError, NotFoundError } from '@/lib/utils/errors';
import { DevWipeService } from '@/services/dev-wipe.service';
import { query } from '@/lib/db';

function wipeAllowed(): boolean {
  return process.env.ALLOW_DEV_DATA_WIPE === 'true';
}

const idSchema = z.string().uuid();

/**
 * DELETE /api/admin/wipe-tramites/:id — elimina un trámite y datos ligados (requiere ALLOW_DEV_DATA_WIPE=true).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('ADMIN');
    if (!wipeAllowed()) {
      throw new ForbiddenError('La eliminación de datos por API no está habilitada en el servidor.');
    }
    const { id } = await params;
    const tramiteId = idSchema.parse(id);
    const exists = await query(`SELECT 1 FROM tramites WHERE id = $1::uuid LIMIT 1`, [tramiteId]);
    if (exists.rows.length === 0) {
      throw new NotFoundError('Trámite no encontrado.');
    }
    await DevWipeService.wipeSingleTramite(tramiteId);
    return successResponse({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
