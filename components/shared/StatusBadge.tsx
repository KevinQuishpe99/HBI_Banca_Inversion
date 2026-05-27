'use client';

import { CaseStatus } from '@/types/case.types';
import { WorkflowStepStatus } from '@/types/flow.types';
import { STATUS_VARIANT_CLASSES } from '@/lib/status-config';
import { CASE_STATUS_LABEL_ES, caseStatusLabelEs } from '@/lib/case-status-display';
import { useStatusMetaForBadge } from '@/hooks/useStatusMeta';

interface StatusBadgeProps {
  status: CaseStatus | WorkflowStepStatus;
  /** Estados de trámite vs estados de paso del workflow (mismo código puede tener etiqueta distinta en BD) */
  kind?: 'case' | 'workflow';
  size?: 'sm' | 'md' | 'lg';
}

const FALLBACK_WORKFLOW: Record<string, { label: string; variant: string }> = {
  PENDING: { label: 'Pendiente', variant: 'gray' },
  IN_PROGRESS: { label: 'En progreso', variant: 'blue' },
  APPROVED: { label: 'Aprobado', variant: 'green' },
  /** Pasos antiguos; el flujo actual usa devolución al solicitante, no rechazo de paso */
  REJECTED: { label: 'Devuelto', variant: 'orange' },
  SKIPPED: { label: 'Omitido', variant: 'slate' },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base',
};

export function StatusBadge({ status, kind = 'case', size = 'md' }: StatusBadgeProps) {
  const { data: rows = [] } = useStatusMetaForBadge(kind);
  const fromDb = rows.find((r) => r.code === status);

  const fallbackMap = kind === 'case' ? CASE_STATUS_LABEL_ES : FALLBACK_WORKFLOW;
  const fb = fallbackMap[status];

  const label =
    fromDb?.label ??
    fb?.label ??
    (kind === 'case' ? caseStatusLabelEs(String(status)) : String(status));
  const variant = fromDb?.variant ?? fb?.variant ?? 'gray';
  const color = STATUS_VARIANT_CLASSES[variant] ?? STATUS_VARIANT_CLASSES.gray;

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${color} ${sizeClasses[size]}`}>
      {label}
    </span>
  );
}
