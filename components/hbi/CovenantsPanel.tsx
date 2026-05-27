'use client';

import { Loader2, ShieldCheck, ShieldX, AlertCircle } from 'lucide-react';
import {
  useActualizarCovenant,
  useHbiCarteraKpis,
  useHbiCovenants,
} from '@/hooks/useHbiIbAvanzado';
import { useHbiOperaciones } from '@/hooks/useHbiOperaciones';
import type { EstadoCovenant } from '@/types/hbi/ib-avanzado.types';
import Link from 'next/link';

const ESTADO_STYLE: Record<
  EstadoCovenant,
  { label: string; className: string; icon: typeof ShieldCheck }
> = {
  CUMPLE: { label: 'Cumple', className: 'bg-emerald-100 text-emerald-800', icon: ShieldCheck },
  EN_RIESGO: { label: 'En riesgo', className: 'bg-amber-100 text-amber-800', icon: AlertCircle },
  INCUMPLIDO: { label: 'Incumplido', className: 'bg-red-100 text-red-800', icon: ShieldX },
  PENDIENTE_TEST: { label: 'Pendiente test', className: 'bg-slate-100 text-slate-700', icon: AlertCircle },
};

type Props = { operacionId?: string };

export function CovenantsPanel({ operacionId }: Props) {
  const { data: covenants, isLoading } = useHbiCovenants(operacionId);
  const actualizar = useActualizarCovenant(operacionId ?? '');

  if (!operacionId) return null;

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  const lista = covenants ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-slate-900">Monitoreo de covenants</h3>
        <p className="mt-1 text-sm text-slate-600">
          Ratios financieros, reporting y garantías — estándar en plataformas de loan agency (Allvue, DebtDomain,
          Cassiopae).
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Covenant</th>
              <th className="px-4 py-3">Umbral</th>
              <th className="px-4 py-3">Actual</th>
              <th className="px-4 py-3">Próximo test</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lista.map((c) => {
              const st = ESTADO_STYLE[c.estado];
              const Icon = st.icon;
              return (
                <tr key={c.id} className="bg-white hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{c.nombre}</p>
                    <p className="text-xs text-slate-500">{c.codigo} · {c.anexoResponsable.replace('_', ' ')}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700">{c.umbral}</td>
                  <td className="px-4 py-3 font-mono text-slate-800">{c.valorActual}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(c.proximoTest).toLocaleDateString('es-CO')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${st.className}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.estado === 'EN_RIESGO' ? (
                      <button
                        type="button"
                        disabled={actualizar.isPending}
                        onClick={() => actualizar.mutate({ covenantId: c.id, estado: 'CUMPLE' })}
                        className="text-xs font-medium text-blue-700 hover:underline disabled:opacity-50"
                      >
                        Marcar cumplido
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CarteraRiesgosView() {
  const { data: kpis, isLoading: loadingKpis } = useHbiCarteraKpis();
  const { data: operaciones, isLoading: loadingOps } = useHbiOperaciones();

  if (loadingKpis || loadingOps) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-800">Covenants en riesgo / incumplidos</p>
          <p className="mt-2 text-3xl font-bold text-amber-900">{kpis?.covenantsEnRiesgo ?? 0}</p>
        </article>
        <article className="rounded-xl border border-violet-200 bg-violet-50 p-5">
          <p className="text-sm text-violet-800">Comités abiertos</p>
          <p className="mt-2 text-3xl font-bold text-violet-900">{kpis?.comitesPendientes ?? 0}</p>
        </article>
        <article className="rounded-xl border border-rose-200 bg-rose-50 p-5">
          <p className="text-sm text-rose-800">Obligaciones próximas (7 días)</p>
          <p className="mt-2 text-3xl font-bold text-rose-900">{kpis?.obligacionesProximas7Dias ?? 0}</p>
        </article>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-900">Matriz por operación</h3>
        <p className="mt-1 text-sm text-slate-600">Acceda al detalle de covenants y comité en cada crédito.</p>
        <ul className="mt-4 divide-y divide-slate-100">
          {(operaciones ?? []).map((op) => (
            <li key={op.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-medium text-slate-900">{op.nombreCredito}</p>
                <p className="text-xs text-slate-500">{op.codigoOperacion}</p>
              </div>
              <div className="flex items-center gap-2">
                {op.alertasActivas ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    Alerta activa
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                    Estable
                  </span>
                )}
                <Link
                  href={`/operaciones/${op.id}`}
                  className="rounded-lg border border-blue-200 px-3 py-1 text-sm font-medium text-blue-800 hover:bg-blue-50"
                >
                  Ver riesgos
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
