import { query } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { enModoDemoMeta, META_DEMO } from '@/lib/demo/meta-demo';

type Row = { code: string; label: string; is_active: boolean; sort_order: number };

export async function GET() {
  try {
    if (enModoDemoMeta()) {
      return successResponse(META_DEMO.signatureTypes);
    }
    const result = await query<Row>(
      `SELECT codigo AS code, nombre AS label, activo AS is_active, orden AS sort_order
       FROM configuracion_tipos_firma
       WHERE activo = true
       ORDER BY orden ASC`
    );
    return successResponse(result.rows.map((r) => ({ code: r.code, label: r.label, sortOrder: r.sort_order })));
  } catch (error) {
    return errorResponse(error);
  }
}
