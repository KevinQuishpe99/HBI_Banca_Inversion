type Props = {
  /** Encabezado login / registro (centrado, más alto) */
  variant?: 'login' | 'header';
};

/**
 * Wordmark HBI para demo (sin dependencia de assets locales).
 */
export function ComwareLogo({ variant = 'login' }: Props) {
  if (variant === 'header') {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-hbi-primary)] text-sm font-bold text-white shadow-sm">
          HBI
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight text-[var(--color-hbi-primary)]">
            Helm Banca de Inversión
          </p>
          <p className="truncate text-[10px] uppercase tracking-wide text-[var(--color-hbi-secondary)]">
            Agente de Financiación
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-hbi-border)] bg-white px-4 py-3 shadow-sm">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-hbi-primary)] text-base font-bold text-white shadow-sm">
          HBI
        </span>
        <div className="text-left">
          <p className="text-base font-semibold leading-tight text-[var(--color-hbi-primary)] sm:text-lg">
            Helm Banca de Inversión
          </p>
          <p className="text-xs uppercase tracking-wide text-[var(--color-hbi-secondary)]">
            Agente de Financiación
          </p>
        </div>
      </div>
    </div>
  );
}
