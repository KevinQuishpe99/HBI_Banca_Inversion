'use client';

import { Calendar, Check, Loader2 } from 'lucide-react';
import { useHbiObligaciones, useMarcarObligacion } from '@/hooks/useHbiIbAvanzado';

type Props = { operacionId: string };

export function CalendarioObligacionesPanel({ operacionId }: Props) {
  const { data: obligaciones, isLoading } = useHbiObligaciones(operacionId);
  const marcar = useMarcarObligacion(operacionId);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  const lista = obligaciones ?? [];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-slate-900">Calendario de obligaciones</h3>
        <p className="mt-1 text-sm text-slate-600">
          Vencimientos de reporting, pagos, comités y garantías — agenda unificada del agente de financiación.
        </p>
      </div>

      <div className="space-y-2">
        {lista.map((o) => {
          const fecha = new Date(o.fechaLimite);
          const vencida = !o.cumplida && fecha < hoy;
          const proxima =
            !o.cumplida &&
            !vencida &&
            fecha.getTime() - hoy.getTime() <= 7 * 24 * 60 * 60 * 1000;

          return (
            <article
              key={o.id}
              className={[
                'flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4',
                o.cumplida
                  ? 'border-emerald-200 bg-emerald-50/50 opacity-80'
                  : vencida
                    ? 'border-red-200 bg-red-50/50'
                    : proxima
                      ? 'border-amber-200 bg-amber-50/50'
                      : 'border-slate-200 bg-white',
              ].join(' ')}
            >
              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-500" />
                <div>
                  <p className={`font-medium ${o.cumplida ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                    {o.titulo}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {o.tipo.replace(/_/g, ' ')} · {o.responsable} · {o.anexo.replace('_', ' ')}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {fecha.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {o.critica && !o.cumplida ? (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800">
                    Crítica
                  </span>
                ) : null}
                {vencida && !o.cumplida ? (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                    Vencida
                  </span>
                ) : null}
                {!o.cumplida ? (
                  <button
                    type="button"
                    disabled={marcar.isPending}
                    onClick={() => marcar.mutate(o.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Cumplida
                  </button>
                ) : (
                  <span className="text-xs font-medium text-emerald-700">Completada</span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
