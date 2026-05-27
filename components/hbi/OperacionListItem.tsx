'use client';

import Link from 'next/link';
import type { OperacionCredito } from '@/types/hbi/operacion.types';
import { TIPOS_SERVICIO_LABEL } from '@/types/hbi/operacion.types';
import { AlertTriangle, ChevronRight } from 'lucide-react';

const FASE_LABEL: Record<string, string> = {
  FASE_1_CONTRATOS: 'Contratos',
  FASE_2_CORREOS: 'Correos',
  FASE_3_EXPEDIENTE: 'Expediente',
  FASE_4_SEGUIMIENTO: 'Seguimiento',
};

type Props = {
  operacion: OperacionCredito;
};

export function OperacionListItem({ operacion }: Props) {
  return (
    <Link
      href={`/operaciones/${operacion.id}`}
      className="group flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-slate-500">{operacion.codigoOperacion}</span>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
            {FASE_LABEL[operacion.faseActual] ?? operacion.faseActual}
          </span>
          {operacion.alertasActivas ? (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              Alertas
            </span>
          ) : null}
        </div>
        <h3 className="mt-1 truncate font-semibold text-slate-900 group-hover:text-blue-900">
          {operacion.nombreCredito}
        </h3>
        {operacion.deudor ? (
          <p className="mt-0.5 text-sm text-slate-600">Deudor: {operacion.deudor}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1">
          {operacion.serviciosActivos.map((s) => (
            <span
              key={s}
              className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
            >
              {TIPOS_SERVICIO_LABEL[s].replace('Anexo ', '')}
            </span>
          ))}
        </div>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 group-hover:text-blue-600" />
    </Link>
  );
}
