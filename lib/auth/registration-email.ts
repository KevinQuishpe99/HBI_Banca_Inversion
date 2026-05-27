export function isComwareRegistrationEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at < 1) return false;
  const domain = e.slice(at + 1);
  return domain === 'comware.com.ec';
}

const COMWARE_DOMAIN = 'comware.com.ec';

export function getComwareEmailRegistrationHint(email: string): string | null {
  const t = email.trim().toLowerCase();
  if (!t) return null;
  if (isComwareRegistrationEmail(t)) return null;
  const at = t.lastIndexOf('@');
  if (at < 1) return null;
  const domain = t.slice(at + 1);
  if (!domain.includes('.')) return null;
  if (COMWARE_DOMAIN.startsWith(domain)) return null;
  return 'Usa un correo @comware.com.ec.';
}
