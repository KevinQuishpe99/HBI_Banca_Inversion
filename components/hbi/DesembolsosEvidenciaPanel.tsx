'use client';

import { Calendar, CheckCircle2, Clock, Wallet } from 'lucide-react';
import { formatearMonto } from '@/lib/hbi/hitos-plantilla';
import { labelFaseProyecto } from '@/lib/hbi/desembolsos-domain';
import type { HitoDesembolsoHbi } from '@/types/hbi/cliente.types';

type Props = {
  hitos: HitoDesembolsoHbi[];
  montoTotal: number;
  moneda: 'USD' | 'COP';
  titulo?: string;
  compacto?: boolean;
};

const ESTADO_STYLE: Record<string, { label: string; className: string }> = {
  COMPLETADO: { label: 'Desembolsado', className: 'bg-emerald-100 text-emerald-800' },
  APROBADO: { label: 'Aprobado', className: 'bg-blue-100 text-blue-800' },
  EN_REVISION: { label: 'En revisión', className: 'bg-amber-100 text-amber-800' },
  PENDIENTE_APROBACION: { label: 'Pendiente', className: 'bg-slate-100 text-slate-700' },
  PENDIENTE: { label: 'Pendiente', className: 'bg-slate-100 text-slate-700' },
};

export function DesembolsosEvidenciaPanel({
  hitos,
  montoTotal,
  moneda,
  titulo = 'Plan de desembolsos del proyecto',
  compacto = false,
}: Props) {
  if (hitos.length === 0) return null;

  const porcentajeTotal = hitos.reduce((s, h) => s + h.porcentaje, 0);
  const desembolsado = hitos
    .filter((h) => h.aprobado || h.estado === 'COMPLETADO')
    .reduce((s, h) => s + (h.montoAprobado || h.monto), 0);
  const ordenados = [...hitos].sort(
    (a, b) => new Date(a.fechaObjetivo).getTime() - new Date(b.fechaObjetivo).getTime()
  );

  return (
    <section className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-indigo-700" />
            <h3 className="font-semibold text-slate-900">{titulo}</h3>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {hitos.length} desembolso(s) programado(s) · {porcentajeTotal}% del crédito · evidencia
            por fase del proyecto
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="text-slate-500">Total crédito</p>
          <p className="font-mono font-bold text-indigo-800">{formatearMonto(montoTotal, moneda)}</p>
          <p className="mt-1 text-xs text-emerald-700">
            Ejecutado: {formatearMonto(desembolsado, moneda)}
          </p>
        </div>
      </div>

      {/* Barra visual de % */}
      <div className="mt-4 flex h-8 overflow-hidden rounded-lg ring-1 ring-slate-200">
        {ordenados.map((h, i) => {
          const colores = [
            'bg-indigo-500',
            'bg-violet-500',
            'bg-blue-500',
            'bg-cyan-500',
            'bg-teal-500',
            'bg-emerald-500',
            'bg-amber-500',
            'bg-rose-500',
          ];
          return (
            <div
              key={h.id}
              style={{ width: `${h.porcentaje}%` }}
              className={`${colores[i % colores.length]} flex items-center justify-center text-[10px] font-bold text-white`}
              title={`${h.id}: ${h.porcentaje}%`}
            >
              {h.porcentaje >= 8 ? `${h.id} ${h.porcentaje}%` : h.id}
            </div>
          );
        })}
      </div>
      {porcentajeTotal !== 100 ? (
        <p className="mt-1 text-xs font-medium text-amber-700">
          Atención: los porcentajes suman {porcentajeTotal}% (debe ser 100%)
        </p>
      ) : null}

      {/* Timeline */}
      <div className={`mt-5 space-y-0 ${compacto ? 'space-y-2' : ''}`}>
        {ordenados.map((h, i) => {
          const st = ESTADO_STYLE[h.estado] ?? ESTADO_STYLE.PENDIENTE;
          const checklist = h.checklistDocumental ?? [];
          const ok = checklist.filter((c) => c.cumplido).length;
          const fecha = new Date(h.fechaObjetivo);
          const esUltimo = i === ordenados.length - 1;

          return (
            <div key={h.id} className="relative flex gap-4">
              {!esUltimo ? (
                <div className="absolute left-[15px] top-10 h-[calc(100%-8px)] w-0.5 bg-indigo-200" />
              ) : null}
              <div
                className={[
                  'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  h.aprobado || h.estado === 'COMPLETADO'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white text-indigo-700 ring-2 ring-indigo-300',
                ].join(' ')}
              >
                {h.aprobado || h.estado === 'COMPLETADO' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  h.id.replace('H', '')
                )}
              </div>
              <article
                className={[
                  'mb-4 min-w-0 flex-1 rounded-lg border p-4',
                  h.aprobado || h.estado === 'COMPLETADO'
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : 'border-slate-200 bg-white',
                ].join(' ')}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {h.id} · {h.nombre}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {h.fechaDesembolsoEjecutado
                          ? `Desembolsado: ${new Date(h.fechaDesembolsoEjecutado).toLocaleDateString('es-CO')}`
                          : new Date(h.fechaObjetivo).toLocaleDateString('es-CO', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                      </span>
                      <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-800">
                        {labelFaseProyecto(h.faseProyecto)}
                      </span>
                      <span className="font-mono font-semibold text-indigo-800">
                        {h.porcentaje}% = {formatearMonto(h.monto, moneda)}
                      </span>
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.className}`}>
                    {st.label}
                  </span>
                </div>

                {!compacto ? (
                  <>
                    {h.aprobado || h.montoAprobado > 0 ? (
                      <p className="mt-2 text-sm text-emerald-800">
                        Monto aprobado:{' '}
                        <span className="font-mono font-semibold">
                          {formatearMonto(h.montoAprobado || h.monto, moneda)}
                        </span>
                      </p>
                    ) : (
                      <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5" />
                        Pendiente aprobación de comité y checklist documental
                      </p>
                    )}
                    {checklist.length > 0 ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Checklist documental: {ok}/{checklist.length} cumplidos
                      </p>
                    ) : null}
                  </>
                ) : null}
              </article>
            </div>
          );
        })}
      </div>

      {/* Tabla resumen */}
      {!compacto ? (
        <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Fase / desembolso</th>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">%</th>
                <th className="px-3 py-2">Monto</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {ordenados.map((h) => {
                const st = ESTADO_STYLE[h.estado] ?? ESTADO_STYLE.PENDIENTE;
                return (
                  <tr key={h.id}>
                    <td className="px-3 py-2 font-mono font-medium text-indigo-700">{h.id}</td>
                    <td className="px-3 py-2 text-slate-800">{h.nombre}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {new Date(h.fechaObjetivo).toLocaleDateString('es-CO')}
                    </td>
                    <td className="px-3 py-2 font-mono">{h.porcentaje}%</td>
                    <td className="px-3 py-2 font-mono">{formatearMonto(h.monto, moneda)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.className}`}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-indigo-50/80 text-sm font-medium">
              <tr>
                <td colSpan={3} className="px-3 py-2 text-slate-700">
                  Total ({hitos.length} desembolsos)
                </td>
                <td className="px-3 py-2 font-mono">{porcentajeTotal}%</td>
                <td className="px-3 py-2 font-mono">{formatearMonto(montoTotal, moneda)}</td>
                <td className="px-3 py-2 text-emerald-700">
                  {formatearMonto(desembolsado, moneda)} ejecutado
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}
    </section>
  );
}
