'use client';

import { useState } from 'react';
import type { CorreoOperacion, DocumentoContractual, InfoProyectoHbi, OperacionVista360 } from '@/types/hbi/operacion.types';
import { TIPOS_SERVICIO_LABEL } from '@/types/hbi/operacion.types';
import { EstructuraFinancieraCard } from '@/components/hbi/EstructuraFinancieraCard';
import { VisorDocumentoModal } from '@/components/hbi/VisorDocumentoModal';
import { FileText, Mail, ListChecks, History, Calendar, Users, Bell, Eye } from 'lucide-react';

type Props = {
  data: OperacionVista360;
};

export function Vista360Panel({ data }: Props) {
  const [docSel, setDocSel] = useState<DocumentoContractual | null>(null);
  const [correoSel, setCorreoSel] = useState<CorreoOperacion | null>(null);
  const exp = data.expediente;
  const alertas = (exp?.alertas ?? []) as Array<{ tipo?: string; mensaje?: string; severidad?: string }>;
  const comunicaciones = exp?.comunicacionesResumen as Record<string, unknown> | undefined;
  const resumen = exp?.resumenContractual as Record<string, unknown> | undefined;
  const infoProyecto = data.metadata?.infoProyecto as InfoProyectoHbi | undefined;

  return (
    <>
    <div className="grid gap-6 lg:grid-cols-2">
      <EstructuraFinancieraCard metadata={data.metadata} />

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
        <h3 className="font-semibold text-slate-900">Resumen contractual (paquete del crédito)</h3>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-500">Código</dt>
            <dd className="font-mono text-sm">{String(resumen?.codigoOperacion ?? data.codigoOperacion)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Deudor</dt>
            <dd className="text-sm font-medium">{String(resumen?.deudor ?? data.deudor ?? '—')}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Documentos</dt>
            <dd className="text-sm">{data.documentos.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Anexos activos</dt>
            <dd className="text-sm">{data.serviciosActivos.length}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900">
          <FileText className="h-5 w-5 text-blue-600" />
          Documentos ({data.documentos.length})
        </h3>
        <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
          {data.documentos.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-slate-800">{d.nombreArchivo}</span>
              <div className="flex shrink-0 items-center gap-1">
                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                  {d.tipoDocumento}
                </span>
                <button
                  type="button"
                  onClick={() => setDocSel(d)}
                  className="rounded p-1 text-blue-700 hover:bg-blue-50"
                  title="Ver documento"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
              </div>
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
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setCorreoSel(c)}
                className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-indigo-50"
              >
                <span className="font-medium">{c.asunto}</span>
                <span className="block text-xs text-slate-500">
                  {c.origen} · {c.prioridad}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {correoSel ? (
          <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 text-sm">
            <p className="font-medium text-slate-900">{correoSel.asunto}</p>
            <p className="text-xs text-slate-500">{correoSel.remitente}</p>
            <p className="mt-2 whitespace-pre-wrap text-slate-700">
              {correoSel.cuerpoResumen ?? 'Sin cuerpo.'}
            </p>
          </div>
        ) : null}
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
          Proyecto y responsable
        </h3>
        {infoProyecto?.responsableNombre ? (
          <dl className="mt-2 space-y-1 text-sm">
            <div>
              <dt className="text-xs text-slate-500">PMO / responsable</dt>
              <dd className="font-medium">{infoProyecto.responsableNombre}</dd>
            </div>
            {infoProyecto.sector ? (
              <div>
                <dt className="text-xs text-slate-500">Sector</dt>
                <dd>{infoProyecto.sector}</dd>
              </div>
            ) : null}
            {infoProyecto.viabilidad ? (
              <div>
                <dt className="text-xs text-slate-500">Viabilidad</dt>
                <dd className="font-medium text-teal-800">{infoProyecto.viabilidad.replace(/_/g, ' ')}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            Complete la ficha en Fase 2 (Correos) para evaluar viabilidad del proyecto.
          </p>
        )}
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
    <VisorDocumentoModal documento={docSel} onCerrar={() => setDocSel(null)} />
    </>
  );
}
