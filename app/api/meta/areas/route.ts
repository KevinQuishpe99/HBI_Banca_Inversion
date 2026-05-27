import { query } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { enModoDemoMeta, META_DEMO } from '@/lib/demo/meta-demo';

type AreaRow = {
  id: number;
  area: string;
  label: string | null;
  is_selectable: boolean;
  is_mandatory: boolean;
  es_paso_final: boolean;
  notify_on_high_amount: boolean;
  sort_order: number;
  supervisor_name: string | null;
};

/**
 * GET /api/meta/areas
 * Devuelve configuración de áreas desde la base de datos.
 */
export async function GET() {
  try {
    if (enModoDemoMeta()) {
      return successResponse(META_DEMO.areas);
    }
    const result = await query<AreaRow>(
      `SELECT ca.id,
              ca.id::text AS area,
              ca.nombre_area AS label,
              ca.seleccionable AS is_selectable,
              ca.obligatorio AS is_mandatory,
              ca.es_paso_final AS es_paso_final,
              ca.notificar_monto_alto AS notify_on_high_amount,
              ca.orden AS sort_order,
              NULLIF(trim(COALESCE(su.nombre,'') || ' ' || COALESCE(su.apellido,'')), '') AS supervisor_name
       FROM configuracion_areas ca
       LEFT JOIN usuarios su ON su.id = ca.supervisor_id
       WHERE ca.activo = true
       ORDER BY ca.orden ASC`
    );

    return successResponse(
      result.rows.map((r) => ({
        id: r.id,
        area: r.area,
        label: r.label,
        isSelectable: r.is_selectable,
        isMandatory: r.is_mandatory,
        isFinalStep: r.es_paso_final,
        notifyOnHighAmount: r.notify_on_high_amount,
        sortOrder: r.sort_order,
        supervisorName: r.supervisor_name,
      }))
    );
  } catch (error) {
    return errorResponse(error);
  }
}
