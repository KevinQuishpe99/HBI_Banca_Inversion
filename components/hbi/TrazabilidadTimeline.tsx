'use client';

import { useHbiTrazabilidad } from '@/hooks/useHbiOperaciones';
import type { TipoEventoTrazabilidad } from '@/types/hbi/operacion.types';
import { TIPOS_SERVICIO_LABEL } from '@/types/hbi/operacion.types';
import {
  History,
  FileText,
  Mail,
  Send,
  ListChecks,
  GitBranch,
  Loader2,
  Filter,
} from 'lucide-react';
import { useState } from 'react';

const ICONOS: Record<TipoEventoTrazabilidad, typeof History> = {
  HISTORIAL: History,
  DOCUMENTO: FileText,
  CORREO_RECIBIDO: Mail,
  CORREO_ENVIADO: Send,
  ACTIVIDAD: ListChecks,
  CAMBIO_FASE: GitBranch,
};

const COLORES: Record<TipoEventoTrazabilidad, string> = {
  HISTORIAL: 'border-slate-200 bg-slate-50',
  DOCUMENTO: 'border-blue-200 bg-blue-50',
  CORREO_RECIBIDO: 'border-indigo-200 bg-indigo-50',
  CORREO_ENVIADO: 'border-violet-200 bg-violet-50',
  ACTIVIDAD: 'border-emerald-200 bg-emerald-50',
  CAMBIO_FASE: 'border-amber-200 bg-amber-50',
};

type Props = { operacionId: string };

export function TrazabilidadTimeline({ operacionId }: Props) {
  const { data, isLoading, error } = useHbiTrazabilidad(operacionId);
  const [filtro, setFiltro] = useState<TipoEventoTrazabilidad | 'TODOS'>('TODOS');

  const eventos =
    filtro === 'TODOS'
      ? data?.eventos ?? []
      : (data?.eventos ?? []).filter((e) => e.tipo === filtro);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">{error.message}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-slate-500" />
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as TipoEventoTrazabilidad | 'TODOS')}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="TODOS">Todos los eventos ({data?.total ?? 0})</option>
          <option value="CORREO_ENVIADO">Correos enviados</option>
          <option value="CORREO_RECIBIDO">Correos recibidos</option>
          <option value="DOCUMENTO">Documentos</option>
          <option value="ACTIVIDAD">Actividades</option>
          <option value="CAMBIO_FASE">Cambios de fase</option>
          <option value="HISTORIAL">Otros</option>
        </select>
      </div>

      {eventos.length === 0 ? (
        <p className="text-sm text-slate-500">Sin eventos en esta categoría.</p>
      ) : (
        <ol className="relative space-y-0 border-l-2 border-violet-200 pl-6">
          {eventos.map((ev) => {
            const Icon = ICONOS[ev.tipo] ?? History;
            return (
              <li key={ev.id} className="relative pb-6 last:pb-0">
                <span
                  className={[
                    'absolute -left-[1.65rem] flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-sm',
                    COLORES[ev.tipo],
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4 text-slate-700" />
                </span>
                <div className={['rounded-xl border p-4', COLORES[ev.tipo]].join(' ')}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium text-slate-900">{ev.titulo}</p>
                    <time className="shrink-0 text-xs text-slate-500">
                      {new Date(ev.creadoEn).toLocaleString('es-EC')}
                    </time>
                  </div>
                  {ev.descripcion ? (
                    <p className="mt-1 text-sm text-slate-600">{ev.descripcion}</p>
                  ) : null}
                  {ev.usuarioNombre ? (
                    <p className="mt-1 text-xs text-slate-500">Por: {ev.usuarioNombre}</p>
                  ) : null}
                  {ev.tipoServicio ? (
                    <span className="mt-2 inline-block rounded bg-white/80 px-2 py-0.5 text-xs">
                      {TIPOS_SERVICIO_LABEL[ev.tipoServicio]}
                    </span>
                  ) : null}
                  {ev.tipo === 'DOCUMENTO' && ev.detalle?.hashContenido ? (
                    <p className="mt-2 font-mono text-xs text-slate-500">
                      Huella: {String(ev.detalle.hashContenido)} · v
                      {String(ev.detalle.version ?? 1)}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
