/** Variantes permitidas (admin) → clases Tailwind para badges */
export const STATUS_VARIANT_CLASSES: Record<string, string> = {
  gray: 'bg-gray-100 text-gray-800',
  blue: 'bg-blue-100 text-blue-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  orange: 'bg-orange-100 text-orange-800',
  indigo: 'bg-indigo-100 text-indigo-800',
  purple: 'bg-purple-100 text-purple-800',
  emerald: 'bg-emerald-100 text-emerald-800',
  slate: 'bg-slate-100 text-slate-800',
};

export const STATUS_VARIANT_KEYS = [
  'gray',
  'blue',
  'yellow',
  'green',
  'red',
  'orange',
  'indigo',
  'purple',
  'emerald',
  'slate',
] as const;

export type StatusVariantKey = (typeof STATUS_VARIANT_KEYS)[number];

export function isValidStatusVariant(v: string): v is StatusVariantKey {
  return (STATUS_VARIANT_KEYS as readonly string[]).includes(v);
}

export type StatusConfigRow = {
  code: string;
  label: string;
  variant: string;
  sortOrder: number;
};

/** Si `case_status_config` no existe o está vacío, el meta endpoint devuelve esto (códigos CaseStatus en inglés). */
export const FALLBACK_META_CASE_STATUSES: StatusConfigRow[] = [
  { code: 'SUBMITTED', label: 'Pendiente', variant: 'yellow', sortOrder: 10 },
  { code: 'IN_REVIEW', label: 'Pendiente', variant: 'yellow', sortOrder: 20 },
  { code: 'APPROVED', label: 'Pendiente', variant: 'yellow', sortOrder: 30 },
  { code: 'RETURNED', label: 'Devuelto', variant: 'orange', sortOrder: 40 },
  { code: 'COMPLETED', label: 'Trámite completado', variant: 'emerald', sortOrder: 50 },
];

export const FALLBACK_META_WORKFLOW_STEP_STATUSES: StatusConfigRow[] = [
  { code: 'PENDING', label: 'Pendiente', variant: 'gray', sortOrder: 10 },
  { code: 'IN_PROGRESS', label: 'En progreso', variant: 'blue', sortOrder: 20 },
  { code: 'APPROVED', label: 'Aprobado', variant: 'green', sortOrder: 30 },
  { code: 'REJECTED', label: 'Devuelto', variant: 'orange', sortOrder: 40 },
  { code: 'SKIPPED', label: 'Omitido', variant: 'slate', sortOrder: 50 },
];
