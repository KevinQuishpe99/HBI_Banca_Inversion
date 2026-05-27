'use client';

import type { CaseStatus } from '@/types/case.types';

type Props = {
  reviewedByAreaLabels: string[] | undefined;
  status: CaseStatus;
};

/**
 * Áreas que ya pasaron revisión en el flujo (misma línea en pendiente, devuelto y completado).
 */
export function CaseReviewedByLine({ reviewedByAreaLabels, status }: Props) {
  const labels = reviewedByAreaLabels?.filter(Boolean) ?? [];
  if (labels.length === 0) return null;

  const isReturned = status === 'RETURNED';

  return (
    <p className={`mt-1.5 text-xs leading-snug ${isReturned ? 'text-amber-950' : 'text-emerald-950'}`}>
      <span className="font-semibold">Revisado por:</span>{' '}
      <span className={isReturned ? 'text-amber-900/90' : 'text-emerald-900/85'}>{labels.join(', ')}</span>
    </p>
  );
}
