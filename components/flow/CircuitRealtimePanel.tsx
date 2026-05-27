'use client';

import { useMemo } from 'react';
import { Users, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { WorkflowProgressView } from '@/types/flow.types';
import { useAreaMeta } from '@/hooks/useAreaLabelByCode';
import { displayStepLabel } from '@/components/flow/CircuitStepsList';

export type ReviewPresenceUser = {
  area: string;
  displayName: string;
};

type Props = {
  steps: WorkflowProgressView[];
  presenceUsers?: readonly ReviewPresenceUser[];
};

function normalizeStatus(status: string | undefined): string {
  return (status && String(status).trim().toUpperCase()) || 'PENDING';
}

/**
 * Bloque “Estado en tiempo real”: conectados revisando y revisiones ya registradas.
 * Extraído del antiguo stepper horizontal para reutilizarlo junto a la lista numerada del circuito.
 */
export function CircuitRealtimePanel({ steps, presenceUsers = [] }: Props) {
  const { areaLabelByCode } = useAreaMeta();

  const completedReviewRows = useMemo(() => {
    return steps
      .map((step) => {
        const status = normalizeStatus(step.stepStatus as string);
        if ((status !== 'APPROVED' && status !== 'REJECTED') || !step.reviewedByName) return null;
        return {
          key: `${step.stepOrder}-${step.requiredArea}`,
          areaLabel: displayStepLabel(step, areaLabelByCode),
          name: step.reviewedByName,
          status,
          completedAt: step.completedAt,
        };
      })
      .filter(Boolean) as Array<{
        key: string;
        areaLabel: string;
        name: string;
        status: string;
        completedAt?: Date;
      }>;
  }, [steps, areaLabelByCode]);

  const showRealtimePanel = presenceUsers.length > 0 || completedReviewRows.length > 0;

  if (!showRealtimePanel) return null;

  return (
    <div className="mb-6 space-y-3 rounded-xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Estado en tiempo real</p>
      {presenceUsers.length > 0 ? (
        <div className="flex gap-2 text-sm text-slate-800">
          <Users className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" aria-hidden />
          <div>
            <span className="font-medium text-blue-900">Revisando ahora (conectados)</span>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-slate-700">
              {presenceUsers.map((p, i) => {
                const stepMatch = steps.find((s) => String(s.requiredArea) === String(p.area));
                const areaTitle = stepMatch
                  ? displayStepLabel(stepMatch, areaLabelByCode)
                  : areaLabelByCode[p.area] || p.area;
                return (
                  <li key={`${p.area}-${p.displayName}-${i}`}>
                    <span className="font-medium">{p.displayName}</span>
                    <span className="text-slate-500"> — {areaTitle}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : completedReviewRows.length > 0 ? (
        <p className="flex items-start gap-2 text-sm text-slate-500">
          <Users className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
          <span>No hay otros revisores conectados ahora en esta vista.</span>
        </p>
      ) : null}
      {completedReviewRows.length > 0 ? (
        <div className="flex gap-2 border-t border-slate-200 pt-3 text-sm text-slate-800">
          <UserCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-700" aria-hidden />
          <div>
            <span className="font-medium text-emerald-900">Ya registraron su revisión</span>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-slate-700">
              {completedReviewRows.map((row) => (
                <li key={row.key}>
                  <span className="font-medium">{row.name}</span>
                  <span className="text-slate-500"> — {row.areaLabel}</span>
                  {row.status === 'APPROVED' ? (
                    <span className="text-emerald-700"> (aprobado)</span>
                  ) : (
                    <span className="text-amber-800"> (devolución)</span>
                  )}
                  {row.completedAt ? (
                    <span className="text-slate-500">
                      {' '}
                      · {format(new Date(row.completedAt), "d MMM HH:mm", { locale: es })}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
