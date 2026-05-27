import { query } from '@/lib/db';

/**
 * Detecta si existe la columna de migración (evita 500 en GET /api/admin/areas si aún no se aplicó el SQL).
 * Sin caché para que, tras aplicar la migración sin reiniciar Node, el siguiente request ya la vea.
 */
export async function hasSupervisorPuedeCrearTramiteColumn(): Promise<boolean> {
  const r = await query<{ ok: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'configuracion_areas'
        AND column_name = 'supervisor_puede_crear_tramite'
    ) AS ok`
  );
  return r.rows[0]?.ok === true;
}
