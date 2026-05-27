import { NextRequest } from 'next/server';
import { FlowService } from '@/services/flow.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireAuth } from '@/lib/auth/get-session';
import { query } from '@/lib/db';
import { casesStateColumn } from '@/lib/db/cases-schema-compat';
import { dbEstadoTramiteToApp } from '@/lib/db/estado-tramite-map';
import { ForbiddenError, ValidationError } from '@/lib/utils/errors';
import { notifyCaseSubscribers } from '@/lib/realtime/case-events';

/**
 * POST /api/cases/:id/submit
 * Envía un trámite para revisión (nuevo o reenvío)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const sc = await casesStateColumn();
    const caseResult = await query(
      `SELECT creado_por AS created_by, ${sc} AS estado FROM tramites WHERE id = $1`,
      [id]
    );

    if (caseResult.rows.length === 0) {
      throw new ValidationError('Trámite no encontrado');
    }

    const caseData = caseResult.rows[0];

    if (session.user.role !== 'ADMIN' && caseData.created_by !== session.user.id) {
      throw new ForbiddenError('No tienes permiso para enviar este trámite');
    }

    if (dbEstadoTramiteToApp((caseData as { estado: string }).estado) !== 'RETURNED') {
      throw new ValidationError('Solo se pueden reenviar trámites en estado Devuelto');
    }

    await FlowService.resubmitCase(id, session.user.id);

    notifyCaseSubscribers(id);
    return successResponse({ message: 'Trámite enviado exitosamente' });
  } catch (error) {
    return errorResponse(error);
  }
}
