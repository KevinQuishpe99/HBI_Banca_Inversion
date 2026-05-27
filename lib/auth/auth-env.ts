/**
 * Secret y URL de NextAuth quemados — cero variables de entorno obligatorias.
 * NEXTAUTH_* se inyectan en build vía next.config.ts (no mutar process.env en runtime).
 * VERCEL_URL la inyecta Vercel automáticamente en producción.
 */
export const DEMO_AUTH_SECRET = 'hbi-demo-auth-secret-comware-2026';

export function resolveAuthSecret(): string {
  return process.env.NEXTAUTH_SECRET?.trim() || DEMO_AUTH_SECRET;
}

export function resolveAuthUrl(): string {
  const fromEnv = process.env.NEXTAUTH_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionHost) {
    return productionHost.startsWith('http')
      ? productionHost.replace(/\/$/, '')
      : `https://${productionHost}`;
  }

  const vercelHost = process.env.VERCEL_URL?.trim();
  if (vercelHost) return `https://${vercelHost}`;

  return 'http://localhost:3000';
}
