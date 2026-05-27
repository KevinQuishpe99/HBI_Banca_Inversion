/** Límite habitual en columnas `VARCHAR(255)` de `tramites` y tablas relacionadas. */
export const VARCHAR_255 = 255;

export function truncateVarchar255(value: string | null | undefined): string | null | undefined {
  if (value == null) return value;
  const v = value.trim();
  if (v.length <= VARCHAR_255) return v;
  return v.slice(0, VARCHAR_255);
}
