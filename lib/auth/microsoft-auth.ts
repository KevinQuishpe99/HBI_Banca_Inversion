import { query } from '@/lib/db';

/** Email desde claims OIDC de Microsoft / Entra ID. */
export function emailFromMicrosoftProfile(profile: Record<string, unknown> | undefined): string | null {
  if (!profile) return null;
  const raw = profile.email ?? profile.preferred_username ?? profile.upn;
  if (typeof raw !== 'string') return null;
  const e = raw.trim().toLowerCase();
  return e.includes('@') ? e : null;
}

/**
 * Filtro opcional por dominio (ej. `comware.com.ec`).
 * `MICROSOFT_LOGIN_ALLOWED_DOMAINS=dominio1.com,dominio2.com`
 */
export function isMicrosoftLoginDomainAllowed(email: string): boolean {
  const raw = process.env.MICROSOFT_LOGIN_ALLOWED_DOMAINS?.trim();
  if (!raw) return true;
  const domains = raw
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return domains.includes(domain);
}

export type DbUserRowForMicrosoft = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  area_name: string | null;
  area_id: number | null;
  is_active: boolean;
  can_sign: boolean;
};

/** Usuario de la app: la «lista» de quién puede entrar con Microsoft es esta tabla (mismo correo que en Microsoft 365). */
export async function getDbUserForMicrosoftEmail(email: string): Promise<DbUserRowForMicrosoft | null> {
  const result = await query<DbUserRowForMicrosoft>(
    `SELECT u.id, u.email,
            u.nombre AS first_name, u.apellido AS last_name,
            u.rol AS role, ca.nombre_area AS area_name, u.area_id,
            u.activo AS is_active, u.puede_firmar AS can_sign
     FROM usuarios u
     LEFT JOIN configuracion_areas ca ON ca.id = u.area_id
     WHERE lower(trim(u.email)) = lower(trim($1)) LIMIT 1`,
    [email]
  );
  return result.rows[0] ?? null;
}

export function isMicrosoftOAuthConfigured(): boolean {
  return Boolean(
    process.env.AZURE_AUTH_CLIENT_ID?.trim() &&
      process.env.AZURE_AUTH_CLIENT_SECRET?.trim() &&
      process.env.AZURE_AUTH_TENANT_ID?.trim()
  );
}
