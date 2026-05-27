'use client';

import { FASES_WORKFLOW, type FaseWorkflowHbi } from '@/types/hbi/operacion.types';
import { CheckCircle2, Circle, CircleDot } from 'lucide-react';

const ORDEN_FASES: FaseWorkflowHbi[] = [
  'FASE_1_CONTRATOS',
  'FASE_2_CORREOS',
  'FASE_3_EXPEDIENTE',
  'FASE_4_SEGUIMIENTO',
];

type Props = {
  faseActual: FaseWorkflowHbi;
  compact?: boolean;
};

export function FaseWorkflowStepper({ faseActual, compact }: Props) {
  const idxActual = ORDEN_FASES.indexOf(faseActual);

  return (
    <ol className={compact ? 'flex flex-wrap gap-2' : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4'}>
      {FASES_WORKFLOW.map((fase, index) => {
        const orden = ORDEN_FASES.indexOf(fase.codigo);
        const completada = orden < idxActual;
        const actual = fase.codigo === faseActual;
        const pendiente = orden > idxActual;

        const Icon = completada ? CheckCircle2 : actual ? CircleDot : Circle;
        const iconClass = completada
          ? 'text-emerald-600'
          : actual
            ? 'text-blue-600'
            : 'text-slate-300';

        return (
          <li
            key={fase.codigo}
            className={[
              'rounded-xl border p-3 transition-colors',
              actual ? 'border-blue-300 bg-blue-50/80 ring-1 ring-blue-200' : 'border-slate-200 bg-white',
              pendiente ? 'opacity-70' : '',
            ].join(' ')}
          >
            <div className="flex items-start gap-2">
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`} aria-hidden />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Fase {index + 1}
                </p>
                <p className="text-sm font-medium text-slate-900">{fase.titulo.replace(/^Fase \d+ — /, '')}</p>
                {!compact ? (
                  <p className="mt-1 text-xs leading-snug text-slate-600">{fase.descripcion}</p>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
