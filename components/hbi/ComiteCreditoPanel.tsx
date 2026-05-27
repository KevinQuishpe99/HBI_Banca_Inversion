'use client';

import { Loader2, ThumbsDown, ThumbsUp, CheckCircle2 } from 'lucide-react';
import { useHbiComite, useVotarComite } from '@/hooks/useHbiIbAvanzado';
import { formatearMonto } from '@/lib/hbi/hitos-plantilla';
import type { EstadoComite } from '@/types/hbi/ib-avanzado.types';

const ESTADO_COMITE: Record<EstadoComite, string> = {
  PENDIENTE: 'bg-slate-100 text-slate-700',
  EN_REVISION: 'bg-blue-100 text-blue-800',
  APROBADO: 'bg-emerald-100 text-emerald-800',
  RECHAZADO: 'bg-red-100 text-red-800',
  DIFERIDO: 'bg-amber-100 text-amber-800',
};

type Props = { operacionId: string };

export function ComiteCreditoPanel({ operacionId }: Props) {
  const { data: items, isLoading } = useHbiComite(operacionId);
  const votar = useVotarComite(operacionId);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  const lista = items ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-slate-900">Comité de crédito y desembolsos</h3>
        <p className="mt-1 text-sm text-slate-600">
          Flujo de aprobación por acreedores: desembolsos por hito, waivers y modificaciones — similar a loan
          syndication platforms.
        </p>
      </div>

      <div className="space-y-3">
        {lista.map((item) => (
          <article
            key={item.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-900">{item.titulo}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.tipo.replace(/_/g, ' ')} · Sesión{' '}
                  {new Date(item.fechaSesion).toLocaleDateString('es-CO')} · Solicita: {item.solicitante}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTADO_COMITE[item.estado]}`}>
                {item.estado.replace(/_/g, ' ')}
              </span>
            </div>

            {item.montoSolicitado > 0 ? (
              <p className="mt-2 font-mono text-sm font-semibold text-blue-800">
                {formatearMonto(item.montoSolicitado, item.moneda)}
              </p>
            ) : null}

            {item.observaciones ? (
              <p className="mt-2 text-sm text-slate-600">{item.observaciones}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <span>A favor: {item.votosAprobacion}</span>
              <span>En contra: {item.votosRechazo}</span>
              <span>Abstención: {item.votosAbstencion}</span>
            </div>

            {item.estado !== 'APROBADO' && item.estado !== 'RECHAZADO' ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={votar.isPending}
                  onClick={() => votar.mutate({ comiteId: item.id, voto: 'APROBAR' })}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                  Voto a favor
                </button>
                <button
                  type="button"
                  disabled={votar.isPending}
                  onClick={() => votar.mutate({ comiteId: item.id, voto: 'RECHAZAR' })}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                  Voto en contra
                </button>
                <button
                  type="button"
                  disabled={votar.isPending}
                  onClick={() => votar.mutate({ comiteId: item.id, voto: 'APROBAR_SESION' })}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Aprobar sesión (acta)
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
