import { query } from '@/lib/db';

/**
 * Si hay supervisor configurado para el área, solo ese usuario puede actuar como revisor principal.
 * Si no hay supervisor (migración incompleta), se mantiene compatibilidad con cualquier AREA_USER del área.
 */
export async function isUserSupervisorForArea(userId: string, areaId: number): Promise<boolean> {
  const r = await query<{ supervisor_id: string | null }>(
    `SELECT supervisor_id FROM configuracion_areas WHERE id = $1 LIMIT 1`,
    [areaId]
  );
  const sid = r.rows[0]?.supervisor_id;
  if (sid == null) return true;
  return sid === userId;
}
