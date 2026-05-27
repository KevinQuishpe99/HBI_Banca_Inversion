'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  CalendarClock,
  DollarSign,
  Gavel,
  Landmark,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import { useHbiCarteraKpis } from '@/hooks/useHbiIbAvanzado';
import { formatearMonto } from '@/lib/hbi/hitos-plantilla';

export function DashboardEjecutivoHbi() {
  const { data: kpis, isLoading } = useHbiCarteraKpis();

  if (isLoading || !kpis) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  const tarjetas = [
    {
      label: 'Exposición cartera',
      value: formatearMonto(kpis.montoTotalCartera, kpis.monedaPrincipal),
      sub: `${kpis.operacionesActivas} operaciones activas`,
      icon: DollarSign,
      color: 'text-blue-700',
      bg: 'from-blue-50 to-indigo-50',
    },
    {
      label: 'Covenants en riesgo',
      value: String(kpis.covenantsEnRiesgo),
      sub: 'Requieren seguimiento reforzado',
      icon: ShieldAlert,
      color: 'text-amber-700',
      bg: 'from-amber-50 to-orange-50',
      href: '/cartera',
    },
    {
      label: 'Comités pendientes',
      value: String(kpis.comitesPendientes),
      sub: `${kpis.desembolsosPendientesAprobacion} desembolso(s) por aprobar`,
      icon: Gavel,
      color: 'text-violet-700',
      bg: 'from-violet-50 to-purple-50',
    },
    {
      label: 'Obligaciones 7 días',
      value: String(kpis.obligacionesProximas7Dias),
      sub: `${kpis.alertasCriticas} alerta(s) operativas`,
      icon: CalendarClock,
      color: 'text-rose-700',
      bg: 'from-rose-50 to-red-50',
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-[var(--color-brand-primary)]" />
          <h2 className="text-lg font-semibold text-slate-900">Panel ejecutivo · Cartera sindicada</h2>
        </div>
        <div className="flex gap-2">
          <Link
            href="/pipeline"
            className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm font-medium text-blue-800 hover:bg-blue-50"
          >
            Ver Kanban
          </Link>
          <Link
            href="/cartera"
            className="rounded-lg bg-[var(--color-brand-primary)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-brand-primary-hover)]"
          >
            Cartera de riesgos
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map((t) => {
          const Icon = t.icon;
          const inner = (
            <article
              className={`rounded-xl border border-slate-200 bg-gradient-to-br ${t.bg} p-5 shadow-sm transition hover:shadow-md`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.label}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{t.value}</p>
                  <p className="mt-1 text-sm text-slate-600">{t.sub}</p>
                </div>
                <Icon className={`h-6 w-6 flex-shrink-0 ${t.color}`} />
              </div>
            </article>
          );
          return t.href ? (
            <Link key={t.label} href={t.href}>
              {inner}
            </Link>
          ) : (
            <div key={t.label}>{inner}</div>
          );
        })}
      </div>

      {kpis.exposicionPorSector.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Landmark className="h-5 w-5 text-slate-600" />
            <h3 className="font-semibold text-slate-900">Exposición por tipo de crédito</h3>
          </div>
          <div className="space-y-2">
            {kpis.exposicionPorSector.slice(0, 5).map((s) => {
              const pct = kpis.montoTotalCartera
                ? Math.round((s.monto / kpis.montoTotalCartera) * 100)
                : 0;
              return (
                <div key={s.sector}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-slate-800">{s.sector}</span>
                    <span className="text-slate-600">
                      {formatearMonto(s.monto, kpis.monedaPrincipal)} · {s.operaciones} op. · {pct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {kpis.covenantsEnRiesgo > 0 || kpis.comitesPendientes > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
          <div>
            <p className="font-medium text-amber-900">Atención prioritaria</p>
            <p className="mt-1 text-sm text-amber-800">
              Hay {kpis.covenantsEnRiesgo} covenant(s) bajo observación y {kpis.comitesPendientes} sesión(es) de
              comité abiertas. Revise el calendario de obligaciones en cada operación en Fase 4.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
