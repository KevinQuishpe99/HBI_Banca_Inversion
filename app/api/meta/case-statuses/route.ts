import { query } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireAuth } from '@/lib/auth/get-session';
import { FALLBACK_META_CASE_STATUSES } from '@/lib/status-config';
import { caseStatusCodeFromConfigEstadoId } from '@/lib/db/estado-tramite-map';
import { enModoDemoMeta, META_DEMO } from '@/lib/demo/meta-demo';

type Row = { id: number; label: string; variant: string; sort_order: number };

export async function GET() {
  try {
    await requireAuth();
  } catch (error) {
    return errorResponse(error);
  }

  if (enModoDemoMeta()) {
    return successResponse(META_DEMO.caseStatuses);
  }

  try {
    const result = await query<Row>(
      `SELECT id, nombre AS label, variante AS variant, orden AS sort_order
       FROM configuracion_estados
       WHERE activo = true
       ORDER BY orden ASC`
    );
    if (result.rows.length === 0) {
      return successResponse(FALLBACK_META_CASE_STATUSES);
    }
    return successResponse(
      result.rows.map((r) => ({
        code: caseStatusCodeFromConfigEstadoId(r.id),
        label: r.label,
        variant: r.variant,
        sortOrder: r.sort_order,
      }))
    );
  } catch (error) {
    console.error('GET /api/meta/case-statuses:', error);
    return successResponse(FALLBACK_META_CASE_STATUSES);
  }
}
