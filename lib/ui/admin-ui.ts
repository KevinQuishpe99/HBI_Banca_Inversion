/**
 * Clases compartidas para pantallas de administración.
 * Los colores salen de variables en `app/globals.css` (@theme) para contraste consistente.
 */

export const adminPageTitle = 'text-2xl font-bold text-admin-text';
export const adminPageDesc = 'mt-1 text-sm text-admin-text-secondary sm:mt-2';

/** Tarjeta / panel principal */
export const adminCard =
  'overflow-hidden rounded-lg border border-admin-border bg-admin-surface shadow-sm [color-scheme:light]';

/** Barra de acciones sobre tabla o lista */
export const adminToolbar =
  'flex flex-wrap items-center justify-between gap-3 border-b border-admin-border bg-admin-muted px-4 py-3';

export const adminToolbarInner = 'flex flex-wrap items-center gap-2';

export const adminInput =
  'w-full rounded-md border border-admin-border bg-admin-surface px-2 py-1.5 text-sm text-admin-text shadow-sm placeholder:text-admin-placeholder focus:border-admin-primary focus:outline-none focus:ring-2 focus:ring-admin-primary/25';

export const adminSelect = `${adminInput} py-2`;

export const adminLabel = 'block text-xs font-medium text-admin-text-secondary';

export const adminTableHead =
  'bg-admin-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-admin-text-strong';

export const adminTableHeadRight =
  'bg-admin-muted px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-admin-text-strong';

export const adminBtnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-md bg-admin-primary px-3 py-2 text-sm font-medium text-white hover:bg-admin-primary-hover disabled:opacity-50';

export const adminBtnSecondary =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-admin-border bg-admin-surface px-3 py-2 text-sm font-medium text-admin-text hover:bg-admin-muted disabled:opacity-50';

export const adminBtnDangerOutline =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-red-300 bg-admin-surface px-2 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-50';

/** Aviso lateral en zonas sensibles (sin pintar toda la pantalla de rojo). */
export const adminSensitiveStripe = 'border-l-4 border-red-600';
