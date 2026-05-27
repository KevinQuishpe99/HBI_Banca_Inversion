'use client';

import type { OperacionVista360 } from '@/types/hbi/operacion.types';
import { TIPOS_SERVICIO_LABEL } from '@/types/hbi/operacion.types';
import { FileText, Mail, ListChecks, History, Calendar, Users, Bell } from 'lucide-react';

type Props = {
  data: OperacionVista360;
};

export function Vista360Panel({ data }: Props) {
  const exp = data.expediente;
  const alertas = (exp?.alertas ?? []) as Array<{ tipo?: string; mensaje?: string; severidad?: string }>;
  const comunicaciones = exp?.comunicacionesResumen as Record<string, unknown> | undefined;
  const hitos = (data.metadata?.hitosDesembolso ?? []) as Array<{
    id?: string;
    nombre?: string;
    porcentaje?: number;
    estado?: string;
    fechaObjetivo?: string;
    checklistDocumental?: Array<{ item?: string; cumplido?: boolean }>;
  }>;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
        <h3 className="font-semibold text-slate-900">Resumen contractual (paquete del crédito)</h3>
        <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
          {JSON.stringify(exp?.resumenContractual ?? { paquete: data.documentos.length }, null, 2)}
        </pre>
      </section>

      {hitos.length > 0 ? (
        <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-5 shadow-sm lg:col-span-2">
          <h3 className="font-semibold text-slate-900">Desembolsos por hitos (demo premium)</h3>
          <p className="mt-1 text-sm text-slate-600">
            Flujo comercial: avance por hitos con checklist documental antes de autorizar cada desembolso.
          </p>
          <div className="mt-3 space-y-3">
            {hitos.map((h) => {
              const checklist = h.checklistDocumental ?? [];
              const total = checklist.length;
              const ok = checklist.filter((c) => c.cumplido === true).length;
              return (
                <article key={h.id ?? h.nombre} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">
                      {h.id ?? 'Hito'} · {h.nombre ?? 'Sin nombre'}
                    </p>
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                      {h.porcentaje ?? 0}% · {h.estado ?? 'PENDIENTE'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Fecha objetivo:{' '}
                    {h.fechaObjetivo
                      ? new Date(h.fechaObjetivo).toLocaleDateString('es-CO')
                      : 'Sin fecha'}
                  </p>
                  <p className="mt-2 text-xs text-slate-600">
                    Checklist documental: {ok}/{total} cumplido(s)
                  </p>
                  <ul className="mt-1 space-y-1">
                    {checklist.map((c, i) => (
                      <li key={`${h.id ?? h.nombre}-doc-${i}`} className="text-xs text-slate-700">
                        {c.cumplido ? '✓' : '•'} {c.item ?? 'Documento requerido'}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900">
          <FileText className="h-5 w-5 text-blue-600" />
          Documentos ({data.documentos.length})
        </h3>
        <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
          {data.documentos.map((d) => (
            <li key={d.id} className="flex justify-between gap-2 text-sm">
              <span className="truncate text-slate-800">{d.nombreArchivo}</span>
              <span className="shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                {d.tipoDocumento}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900">
          <Mail className="h-5 w-5 text-indigo-600" />
          Comunicaciones ({data.correos.length})
        </h3>
        {comunicaciones ? (
          <p className="mt-2 text-xs text-slate-500">
            Por origen: {JSON.stringify(comunicaciones.porOrigen ?? {})}
          </p>
        ) : null}
        <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
          {data.correos.slice(0, 10).map((c) => (
            <li key={c.id} className="text-sm">
              <span className="font-medium">{c.asunto}</span>
              <span className="block text-xs text-slate-500">
                {c.origen} · {c.prioridad}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900">
          <Calendar className="h-5 w-5 text-violet-600" />
          Cronogramas
        </h3>
        {(exp?.cronogramas?.length ?? 0) === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Sin cronogramas — cargue documentos tipo CRONOGRAMA.</p>
        ) : (
          <ul className="mt-2 text-sm text-slate-700">
            {(exp?.cronogramas as Array<{ fuente?: string }>).map((c, i) => (
              <li key={i}>{c.fuente ?? 'Cronograma'}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900">
          <Users className="h-5 w-5 text-slate-600" />
          Responsables
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          {data.responsableId
            ? `Responsable asignado (ID: ${data.responsableId.slice(0, 8)}…)`
            : 'Sin responsable asignado — recomendado en Fase 3.'}
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900">
          <Bell className="h-5 w-5 text-amber-600" />
          Alertas ({alertas.length})
        </h3>
        {alertas.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Sin alertas activas en el expediente.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {alertas.map((a, i) => (
              <li key={i} className="text-sm text-amber-900">
                {a.mensaje ?? a.tipo}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900">
          <ListChecks className="h-5 w-5 text-emerald-600" />
          Actividades por anexo (trazabilidad por servicio)
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {data.serviciosActivos.map((s) => {
            const acts = data.actividades.filter((a) => a.tipoServicio === s);
            return (
              <div key={s} className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-medium text-slate-800">{TIPOS_SERVICIO_LABEL[s]}</p>
                <p className="text-xs text-slate-500">{acts.length} actividad(es)</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900">
          <History className="h-5 w-5 text-violet-600" />
          Trazabilidad histórica
        </h3>
        <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto">
          {data.historialReciente.map((h, i) => (
            <li key={i} className="border-b border-slate-50 pb-2 text-sm text-slate-700 last:border-0">
              <span className="font-medium">{h.tipoEvento}</span>
              {h.comentario ? ` — ${h.comentario}` : ''}
              <time className="ml-2 text-xs text-slate-400">
                {new Date(h.creadoEn).toLocaleString('es-EC')}
              </time>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
