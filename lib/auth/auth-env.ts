/**
 * Secret y URL de NextAuth quemados — cero variables de entorno obligatorias.
 * VERCEL_URL la inyecta la plataforma Vercel automáticamente (no es configuración manual).
 */
export const DEMO_AUTH_SECRET = 'hbi-demo-auth-secret-comware-2026';

export function resolveAuthSecret(): string {
  return DEMO_AUTH_SECRET;
}

export function resolveAuthUrl(): string {
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

export function ensureAuthEnv(): void {
  process.env.NEXTAUTH_SECRET = DEMO_AUTH_SECRET;
  process.env.NEXTAUTH_URL = resolveAuthUrl();
}

ensureAuthEnv();
