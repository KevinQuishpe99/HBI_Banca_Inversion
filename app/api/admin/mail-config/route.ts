import { requireRole } from '@/lib/auth/get-session';
import { getMailConfigStatus } from '@/lib/email/mail-config-status';
import { getGraphApplicationAccessToken } from '@/lib/email/graph-mail';
import { successResponse, errorResponse } from '@/lib/utils/response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/admin/mail-config
 * Estado de variables de correo (sin secretos). Opcional ?probe=1 valida token Graph.
 */
export async function GET(request: Request) {
  try {
    await requireRole('ADMIN');
    const status = getMailConfigStatus();
    const url = new URL(request.url);
    const probe = url.searchParams.get('probe') === '1';

    let graphTokenOk: boolean | null = null;
    let graphTokenError: string | null = null;

    if (probe && status.ready) {
      try {
        await getGraphApplicationAccessToken();
        graphTokenOk = true;
      } catch (e) {
        graphTokenOk = false;
        graphTokenError = e instanceof Error ? e.message : String(e);
      }
    }

    return successResponse({
      ...status,
      graphTokenOk,
      graphTokenError,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
