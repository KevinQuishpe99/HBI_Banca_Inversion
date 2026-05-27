/**
 * Demo HBI: sin PostgreSQL, Azure ni variables de entorno en Vercel.
 * Cambiar a false solo cuando exista infraestructura real conectada.
 */
export const MODO_DEMO_HBI = true;

export function esModoDemo(): boolean {
  return MODO_DEMO_HBI;
}
