/**
 * Secret y URL de NextAuth quemados para demo sin variables de entorno.
 * El middleware (proxy.ts) corre en Edge y no hereda los fallbacks de auth.config.ts.
 */
export const DEMO_AUTH_SECRET = 'hbi-demo-auth-secret-comware-2026';

export function resolveAuthSecret(): string {
  const fromEnv = process.env.NEXTAUTH_SECRET?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEMO_AUTH_SECRET;
}

export function resolveAuthUrl(): string {
  const fromEnv = process.env.NEXTAUTH_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionHost) {
    return productionHost.startsWith('http') ? productionHost.replace(/\/$/, '') : `https://${productionHost}`;
  }

  const vercelHost = process.env.VERCEL_URL?.trim();
  if (vercelHost) return `https://${vercelHost}`;

  return 'http://localhost:3000';
}

/** Aplica fallbacks antes de que NextAuth/middleware lean process.env */
export function ensureAuthEnv(): void {
  if (!process.env.NEXTAUTH_SECRET?.trim()) {
    process.env.NEXTAUTH_SECRET = DEMO_AUTH_SECRET;
  }
  if (!process.env.NEXTAUTH_URL?.trim()) {
    process.env.NEXTAUTH_URL = resolveAuthUrl();
  }
}

ensureAuthEnv();
