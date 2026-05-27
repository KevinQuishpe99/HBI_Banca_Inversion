'use client';

import type { EstadoIntegralHbi } from '@/types/hbi/operacion.types';
import { TIPOS_SERVICIO_LABEL, type TipoServicioHbi } from '@/types/hbi/operacion.types';
import { AlertTriangle, CheckCircle2, Circle, Target } from 'lucide-react';

type Props = {
  estado: EstadoIntegralHbi | null | undefined;
  isLoading?: boolean;
};

export function EstadoIntegralBanner({ estado, isLoading }: Props) {
  if (isLoading || !estado) {
    return (
      <div className="animate-pulse rounded-xl border border-slate-200 bg-slate-50 h-28" />
    );
  }

  return (
    <div
      className={[
        'rounded-xl border p-5 shadow-sm',
        estado.alertasActivas
          ? 'border-amber-300 bg-amber-50/90'
          : 'border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50/80',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Target className="h-6 w-6 shrink-0 text-blue-700" />
          <div>
            <h2 className="font-semibold text-slate-900">Estado integral de la operación</h2>
            <p className="mt-1 text-sm text-slate-700">{estado.proximosPasos}</p>
            {estado.mensajeAvance && !estado.puedeAvanzarFase ? (
              <p className="mt-2 flex items-center gap-1 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                {estado.mensajeAvance}
              </p>
            ) : null}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase text-slate-500">Avance global</p>
          <p className="text-2xl font-bold text-blue-800">{estado.avanceGlobal}%</p>
        </div>
      </div>

      {estado.faseActual === 'FASE_4_SEGUIMIENTO' && Object.keys(estado.avancePorAnexo).length > 0 ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {(Object.entries(estado.avancePorAnexo) as [TipoServicioHbi, { porcentaje: number }][]).map(
            ([anexo, av]) => (
              <div key={anexo} className="rounded-lg bg-white/80 px-3 py-2 text-sm">
                <p className="text-xs text-slate-500">{TIPOS_SERVICIO_LABEL[anexo]}</p>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${av.porcentaje}%` }}
                  />
                </div>
                <p className="mt-0.5 text-xs font-medium text-slate-700">{av.porcentaje}%</p>
              </div>
            )
          )}
        </div>
      ) : null}

      {estado.requisitosFase.length > 0 ? (
        <ul className="mt-4 space-y-1.5 border-t border-slate-200/80 pt-3">
          {estado.requisitosFase.map((r) => (
            <li key={r.codigo} className="flex items-start gap-2 text-sm">
              {r.cumplido ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-slate-400" />
              )}
              <span className={r.cumplido ? 'text-slate-600' : 'font-medium text-slate-900'}>
                {r.descripcion}
                {!r.obligatorio ? ' (recomendado)' : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
