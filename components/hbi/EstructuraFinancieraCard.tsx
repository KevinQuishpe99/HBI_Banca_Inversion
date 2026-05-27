'use client';

import type { OperacionCredito } from '@/types/hbi/operacion.types';
import { formatearMonto } from '@/lib/hbi/hitos-plantilla';
import type { EstructuraFinancieraHbi } from '@/types/hbi/cliente.types';

type Props = {
  metadata: OperacionCredito['metadata'];
};

export function EstructuraFinancieraCard({ metadata }: Props) {
  const estructura = metadata?.estructuraFinanciera as EstructuraFinancieraHbi | undefined;
  const hitos = (metadata?.hitosDesembolso ?? []) as Array<{
    id?: string;
    nombre?: string;
    porcentaje?: number;
    monto?: number;
    montoAprobado?: number;
    aprobado?: boolean;
    estado?: string;
    fechaObjetivo?: string;
    checklistDocumental?: Array<{ item?: string; cumplido?: boolean }>;
  }>;

  if (!estructura && hitos.length === 0) return null;

  const moneda = estructura?.moneda ?? 'USD';

  return (
    <section className="rounded-xl border border-[var(--color-brand-border)] bg-white p-5 shadow-sm lg:col-span-2">
      <h3 className="font-semibold text-slate-900">Estructura financiera y sindicado</h3>
      {estructura ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <article className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Monto total aprobado</p>
            <p className="font-mono text-lg font-semibold text-[var(--color-brand-primary)]">
              {formatearMonto(estructura.montoTotal, moneda)}
            </p>
          </article>
          <article className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Comprometido acreedores</p>
            <p className="font-mono text-lg font-semibold text-slate-900">
              {formatearMonto(estructura.montoComprometidoTotal, moneda)}
            </p>
          </article>
          <article className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Tipo crédito</p>
            <p className="text-sm font-medium text-slate-900">
              {String(metadata?.tipoCredito ?? 'Sindicado').replace(/_/g, ' ')}
            </p>
          </article>
        </div>
      ) : null}

      {estructura?.acreedores?.length ? (
        <div className="mt-4">
          <p className="text-sm font-medium text-slate-800">Acreedores (prestan el dinero)</p>
          <ul className="mt-2 space-y-2">
            {estructura.acreedores.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-900">{a.razonSocial}</span>
                <span className="text-slate-600">
                  {a.porcentaje}% · {formatearMonto(a.montoComprometido, moneda)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hitos.length > 0 ? (
        <div className="mt-5">
          <p className="text-sm font-medium text-slate-800">Desembolsos por fases (fondo por hitos)</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Cada hito requiere aprobación de monto base y checklist documental por Anexo antes del desembolso.
          </p>
          <div className="mt-3 space-y-3">
            {hitos.map((h) => {
              const checklist = h.checklistDocumental ?? [];
              const ok = checklist.filter((c) => c.cumplido).length;
              return (
                <article
                  key={h.id ?? h.nombre}
                  className={[
                    'rounded-lg border p-3',
                    h.aprobado ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white',
                  ].join(' ')}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">
                      {h.id} · {h.nombre}
                    </p>
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                      {h.porcentaje ?? 0}% · {h.estado ?? 'PENDIENTE'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Monto fase: {formatearMonto(h.monto ?? 0, moneda)}
                    {h.aprobado && h.montoAprobado
                      ? ` · Aprobado: ${formatearMonto(h.montoAprobado, moneda)}`
                      : ' · Pendiente aprobación'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Checklist: {ok}/{checklist.length}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
