import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/get-session';
import { EmailLogService } from '@/services/email-log.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import type { EmailLogTipo } from '@/types/email-log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TIPOS: EmailLogTipo[] = [
  'CASE_RETURNED',
  'CASE_APPROVED',
  'CASE_COMPLETED',
  'CASE_AREA_NEW',
  'CASE_RESUBMITTED',
  'DEADLINE_ALERT',
  'CASE_HIGH_AMOUNT',
  'ACCOUNT_CREDENTIALS',
  'TEST_MAIL',
  'ADMIN_COMUNICADO',
];

/**
 * GET /api/admin/email-logs?page=1&pageSize=25&tipo=&q=
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole('ADMIN');
    const sp = request.nextUrl.searchParams;
    const page = parseInt(sp.get('page') ?? '1', 10);
    const pageSize = parseInt(sp.get('pageSize') ?? '25', 10);
    const tipoRaw = sp.get('tipo');
    const tipo =
      tipoRaw && TIPOS.includes(tipoRaw as EmailLogTipo) ? (tipoRaw as EmailLogTipo) : null;

    const result = await EmailLogService.list({
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 25,
      tipo,
      q: sp.get('q'),
      tramiteId: sp.get('tramiteId'),
    });

    return successResponse(result);
  } catch (e) {
    return errorResponse(e);
  }
}
