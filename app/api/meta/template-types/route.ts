import { query } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/response';

type Row = { code: string; label: string; is_active: boolean; sort_order: number };

export async function GET() {
  try {
    const result = await query<Row>(
      `SELECT codigo AS code, nombre AS label, activo AS is_active, orden AS sort_order
       FROM configuracion_tipos_plantilla
       WHERE activo = true
       ORDER BY orden ASC`
    );
    return successResponse(result.rows.map((r) => ({ code: r.code, label: r.label, sortOrder: r.sort_order })));
  } catch (error) {
    return errorResponse(error);
  }
}
