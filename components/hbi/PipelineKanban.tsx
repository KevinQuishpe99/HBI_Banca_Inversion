'use client';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useHbiOperaciones } from '@/hooks/useHbiOperaciones';
import { FASES_WORKFLOW, type FaseWorkflowHbi, type OperacionCredito } from '@/types/hbi/operacion.types';
import { formatearMonto } from '@/lib/hbi/hitos-plantilla';

const COLORES_FASE: Record<FaseWorkflowHbi, string> = {
  FASE_1_CONTRATOS: 'border-t-blue-500',
  FASE_2_CORREOS: 'border-t-indigo-500',
  FASE_3_EXPEDIENTE: 'border-t-violet-500',
  FASE_4_SEGUIMIENTO: 'border-t-emerald-500',
};

function montoOperacion(op: OperacionCredito): string {
  const e = op.metadata?.estructuraFinanciera as { montoTotal?: number; moneda?: 'USD' | 'COP' } | undefined;
  if (!e?.montoTotal) return '—';
  return formatearMonto(e.montoTotal, e.moneda ?? 'USD');
}

export function PipelineKanban() {
  const { data: operaciones, isLoading, error } = useHbiOperaciones();

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error.message}</div>
    );
  }

  const ops = operaciones ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {FASES_WORKFLOW.map((fase) => {
        const col = ops.filter((o) => o.faseActual === fase.codigo);
        return (
          <div
            key={fase.codigo}
            className={`rounded-xl border border-slate-200 border-t-4 bg-slate-50/50 ${COLORES_FASE[fase.codigo]}`}
          >
            <div className="border-b border-slate-200 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Fase {FASES_WORKFLOW.indexOf(fase) + 1}
              </p>
              <h3 className="font-semibold text-slate-900">{fase.titulo.replace(/^Fase \d+ — /, '')}</h3>
              <p className="mt-0.5 text-sm text-slate-600">{col.length} deal(s)</p>
            </div>
            <div className="max-h-[420px] space-y-2 overflow-y-auto p-3">
              {col.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-slate-500">
                  Sin operaciones en esta etapa
                </p>
              ) : null}
              {col.map((op) => (
                <Link
                  key={op.id}
                  href={`/operaciones/${op.id}`}
                  className="block rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-blue-300 hover:shadow-md"
                >
                  <p className="font-mono text-xs text-blue-700">{op.codigoOperacion}</p>
                  <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-900">{op.nombreCredito}</p>
                  <p className="mt-1 text-xs text-slate-600">{op.deudor ?? 'Deudor por definir'}</p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{montoOperacion(op)}</span>
                    {op.alertasActivas ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">Alerta</span>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
