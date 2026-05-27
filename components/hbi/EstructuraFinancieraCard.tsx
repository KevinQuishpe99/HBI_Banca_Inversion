'use client';

import type { OperacionCredito } from '@/types/hbi/operacion.types';
import { formatearMonto } from '@/lib/hbi/hitos-plantilla';
import { DesembolsosEvidenciaPanel } from '@/components/hbi/DesembolsosEvidenciaPanel';
import type { EstructuraFinancieraHbi, HitoDesembolsoHbi } from '@/types/hbi/cliente.types';

type Props = {
  metadata: OperacionCredito['metadata'];
};

export function EstructuraFinancieraCard({ metadata }: Props) {
  const estructura = metadata?.estructuraFinanciera as EstructuraFinancieraHbi | undefined;
  const hitos = (metadata?.hitosDesembolso ?? []) as HitoDesembolsoHbi[];

  if (!estructura && hitos.length === 0) return null;

  const moneda = estructura?.moneda ?? 'USD';
  const montoTotal =
    estructura?.montoTotal ?? hitos.reduce((s, h) => s + (h.monto ?? 0), 0);

  return (
    <div className="space-y-5 lg:col-span-2">
      <section className="rounded-xl border border-[var(--color-brand-border)] bg-white p-5 shadow-sm">
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
      </section>

      {hitos.length > 0 ? (
        <DesembolsosEvidenciaPanel
          hitos={hitos}
          montoTotal={montoTotal}
          moneda={moneda}
        />
      ) : null}
    </div>
  );
}
