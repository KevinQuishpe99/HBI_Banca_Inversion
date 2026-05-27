import { query } from '@/lib/db';
import { ValidationError } from '@/lib/utils/errors';

const AREA_CODE = /^[A-Z][A-Z0-9_]*$/;

/**
 * Garantiza que exista una fila en `configuracion_areas` con el código dado.
 * Si no existe, la crea con valores por defecto (activo, no obligatorio, etc.).
 * Devuelve el código normalizado (mayúsculas).
 */
export async function ensureAreaExists(raw: string): Promise<string> {
  const v = raw.trim().toUpperCase();
  if (!AREA_CODE.test(v) || v.length > 63) {
    throw new ValidationError('Código de área inválido (use mayúsculas, números y _).');
  }

  const exists = await query<{ id: number }>(
    `SELECT id FROM configuracion_areas WHERE codigo = $1`,
    [v]
  );

  if (exists.rows.length > 0) {
    return v;
  }

  const maxOrder = await query<{ max_orden: number | null }>(
    `SELECT MAX(orden) AS max_orden FROM configuracion_areas`
  );
  const nextOrder = (maxOrder.rows[0]?.max_orden ?? 0) + 10;

  try {
    await query(
      `INSERT INTO configuracion_areas (codigo, nombre_area, activo, seleccionable, obligatorio, orden,
        es_paso_final, notificar_monto_alto, permite_firma, puede_completar_tramite)
       VALUES ($1, $1, true, true, false, $2, false, false, false, false)
       ON CONFLICT (codigo) DO NOTHING`,
      [v, nextOrder]
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/already exists|duplicate/i.test(msg)) {
      return v;
    }
    throw new ValidationError(
      'No se pudo registrar el código de área en la base de datos. Compruebe permisos del usuario de la BD o contacte al administrador.'
    );
  }
  return v;
}

/**
 * @deprecated Usar ensureAreaExists(). Esta función existe solo por compatibilidad de imports.
 */
export const ensureUserAreaEnumValue = ensureAreaExists;
