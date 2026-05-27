'use client';

import { useEffect, useState } from 'react';
import {
  Calendar,
  FileText,
  GitBranch,
  Landmark,
  Loader2,
  Save,
  User,
  Users,
} from 'lucide-react';
import { useHbiDocumentos, useActualizarTrazabilidadOperacionHbi } from '@/hooks/useHbiOperaciones';
import { useHbiTrazabilidad } from '@/hooks/useHbiOperaciones';
import { VisorDocumentoModal } from '@/components/hbi/VisorDocumentoModal';
import type {
  AsesorFinanciacionHbi,
  DocumentoContractual,
  InfoProyectoHbi,
  OperacionVista360,
  PartesCreditoHbi,
  RegistroFaseHbi,
} from '@/types/hbi/operacion.types';
import { FASES_WORKFLOW } from '@/types/hbi/operacion.types';
import type { EstructuraFinancieraHbi } from '@/types/hbi/cliente.types';
import { historialFasesDe } from '@/lib/hbi/fases-historial';

type Props = {
  data: OperacionVista360;
};

export function TrazabilidadExpedientePanel({ data }: Props) {
  const { data: docs } = useHbiDocumentos(data.id);
  const { data: traz } = useHbiTrazabilidad(data.id);
  const guardar = useActualizarTrazabilidadOperacionHbi(data.id);
  const [docSel, setDocSel] = useState<DocumentoContractual | null>(null);

  const estructura = data.metadata?.estructuraFinanciera as EstructuraFinancieraHbi | undefined;
  const infoProyecto = data.metadata?.infoProyecto as InfoProyectoHbi | undefined;
  const partes = (data.metadata?.partesCredito ?? {}) as PartesCreditoHbi;
  const fases = historialFasesDe(data.metadata, data.creadoEn);

  const [asesor, setAsesor] = useState<AsesorFinanciacionHbi>({
    nombre: partes.asesor?.nombre ?? '',
    entidad: partes.asesor?.entidad ?? '',
    email: partes.asesor?.email ?? '',
    telefono: partes.asesor?.telefono ?? '',
  });
  const [otorgadoPor, setOtorgadoPor] = useState(partes.otorgadoPor ?? '');
  const [fechaApertura, setFechaApertura] = useState(
    partes.fechaAperturaCredito?.slice(0, 10) ?? data.creadoEn.slice(0, 10)
  );
  const [fasesEdit, setFasesEdit] = useState<RegistroFaseHbi[]>(fases);

  useEffect(() => {
    setFasesEdit(historialFasesDe(data.metadata, data.creadoEn));
    const p = (data.metadata?.partesCredito ?? {}) as PartesCreditoHbi;
    setAsesor({
      nombre: p.asesor?.nombre ?? '',
      entidad: p.asesor?.entidad ?? '',
      email: p.asesor?.email ?? '',
      telefono: p.asesor?.telefono ?? '',
    });
    setOtorgadoPor(p.otorgadoPor ?? '');
    setFechaApertura(p.fechaAperturaCredito?.slice(0, 10) ?? data.creadoEn.slice(0, 10));
  }, [data.id, data.metadata, data.creadoEn]);

  const documentos = docs ?? data.documentos;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900">
          <Users className="h-5 w-5 text-blue-600" />
          Partes del crédito y responsables
        </h3>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500">Deudor (beneficiario)</dt>
            <dd className="font-medium text-slate-900">{data.deudor ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Agente de financiación</dt>
            <dd className="font-medium">{data.agenteFinanciacion}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Operación abierta</dt>
            <dd>{new Date(data.creadoEn).toLocaleString('es-CO')}</dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="mb-1 text-xs text-slate-500">Acreedores del sindicato (quienes otorgan el crédito)</dt>
            <dd className="space-y-1">
              {estructura?.acreedores?.length ? (
                estructura.acreedores.map((a) => (
                  <p key={a.id} className="text-sm text-slate-800">
                    <span className="font-medium">{a.razonSocial}</span> — {a.porcentaje}% (
                    {a.montoComprometido.toLocaleString('es-CO')} {estructura.moneda})
                  </p>
                ))
              ) : (
                <p className="text-sm text-slate-500">Sin estructura de acreedores registrada.</p>
              )}
            </dd>
          </div>
          {infoProyecto?.responsableNombre ? (
            <div className="rounded-lg bg-teal-50 p-3 sm:col-span-2">
              <dt className="flex items-center gap-1 text-xs font-semibold text-teal-800">
                <User className="h-3.5 w-3.5" />
                Responsable del proyecto (PMO)
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{infoProyecto.responsableNombre}</dd>
              {infoProyecto.responsableCargo ? (
                <dd className="text-xs text-slate-600">{infoProyecto.responsableCargo}</dd>
              ) : null}
              {infoProyecto.responsableEmail ? (
                <dd className="text-xs text-teal-700">{infoProyecto.responsableEmail}</dd>
              ) : null}
              {infoProyecto.viabilidad ? (
                <dd className="mt-1 text-xs font-semibold text-teal-800">
                  Viabilidad: {infoProyecto.viabilidad.replace(/_/g, ' ')}
                </dd>
              ) : null}
            </div>
          ) : null}
        </dl>

        <form
          className="mt-4 grid gap-3 rounded-lg border border-dashed border-blue-200 bg-blue-50/40 p-4 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await guardar.mutateAsync({
              partesCredito: {
                otorgadoPor: otorgadoPor.trim() || undefined,
                fechaAperturaCredito: new Date(fechaApertura).toISOString(),
                asesor: asesor.nombre.trim()
                  ? {
                      nombre: asesor.nombre.trim(),
                      entidad: asesor.entidad?.trim() || undefined,
                      email: asesor.email?.trim() || undefined,
                      telefono: asesor.telefono?.trim() || undefined,
                    }
                  : undefined,
              },
            });
          }}
        >
          <p className="text-xs font-semibold text-blue-900 sm:col-span-2">
            Asesor / estructurador del crédito (editable)
          </p>
          <input
            placeholder="Nombre del asesor"
            value={asesor.nombre}
            onChange={(e) => setAsesor((p) => ({ ...p, nombre: e.target.value }))}
            className="rounded border px-2 py-1.5 text-sm"
          />
          <input
            placeholder="Entidad / firma"
            value={asesor.entidad ?? ''}
            onChange={(e) => setAsesor((p) => ({ ...p, entidad: e.target.value }))}
            className="rounded border px-2 py-1.5 text-sm"
          />
          <input
            type="email"
            placeholder="Correo asesor"
            value={asesor.email ?? ''}
            onChange={(e) => setAsesor((p) => ({ ...p, email: e.target.value }))}
            className="rounded border px-2 py-1.5 text-sm"
          />
          <input
            placeholder="Líder sindicato / banco agente acreedor"
            value={otorgadoPor}
            onChange={(e) => setOtorgadoPor(e.target.value)}
            className="rounded border px-2 py-1.5 text-sm"
          />
          <div>
            <label className="text-xs text-slate-600">Fecha apertura del crédito</label>
            <input
              type="date"
              value={fechaApertura}
              onChange={(e) => setFechaApertura(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={guardar.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white sm:col-span-2"
          >
            {guardar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar partes y asesor
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50/30 p-5 shadow-sm">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900">
          <GitBranch className="h-5 w-5 text-amber-600" />
          Fechas por fase del workflow
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Fase actual:{' '}
          <strong>{FASES_WORKFLOW.find((f) => f.codigo === data.faseActual)?.titulo}</strong>. Puede
          ajustar fechas de apertura y cierre según el expediente.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            await guardar.mutateAsync({ fasesHistorial: fasesEdit });
          }}
        >
          {fasesEdit.map((f, i) => (
            <div
              key={f.fase}
              className="grid gap-2 rounded-lg border border-amber-100 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              <div className="sm:col-span-2">
                <p className="text-sm font-medium text-slate-900">{f.titulo}</p>
                {f.abiertaPor ? (
                  <p className="text-xs text-slate-500">Abierta por: {f.abiertaPor}</p>
                ) : null}
              </div>
              <div>
                <label className="text-xs text-slate-500">Apertura</label>
                <input
                  type="datetime-local"
                  value={toInputLocal(f.abiertaEn)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFasesEdit((prev) =>
                      prev.map((x, j) =>
                        j === i ? { ...x, abiertaEn: fromInputLocal(v) } : x
                      )
                    );
                  }}
                  className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Cierre</label>
                <input
                  type="datetime-local"
                  value={f.cerradaEn ? toInputLocal(f.cerradaEn) : ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFasesEdit((prev) =>
                      prev.map((x, j) =>
                        j === i ? { ...x, cerradaEn: v ? fromInputLocal(v) : undefined } : x
                      )
                    );
                  }}
                  className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
                />
              </div>
            </div>
          ))}
          <button
            type="submit"
            disabled={guardar.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm text-white"
          >
            {guardar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
            Guardar fechas de fases
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900">
          <FileText className="h-5 w-5 text-blue-600" />
          Trazabilidad de documentos ({documentos.length})
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Archivo</th>
                <th className="py-2 pr-3">Tipo</th>
                <th className="py-2 pr-3">Subido por</th>
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2">Acción</th>
              </tr>
            </thead>
            <tbody>
              {documentos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-slate-500">
                    Sin documentos cargados.
                  </td>
                </tr>
              ) : (
                documentos.map((d) => (
                  <tr key={d.id} className="border-b border-slate-50">
                    <td className="py-2 pr-3 font-medium text-slate-900">{d.nombreArchivo}</td>
                    <td className="py-2 pr-3">
                      <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                        {d.tipoDocumento}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-700">
                      {String(d.datosExtraidos?.subidoPor ?? '—')}
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-500">
                      {new Date(d.creadoEn).toLocaleString('es-CO')}
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => setDocSel(d)}
                        className="text-xs font-medium text-blue-700 hover:underline"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-violet-100 bg-violet-50/30 p-5">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900">
          <Landmark className="h-5 w-5 text-violet-600" />
          Línea de tiempo auditada ({traz?.total ?? 0} eventos)
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Incluye documentos, correos, cambios de fase y desembolsos ejecutados.
        </p>
      </section>

      <VisorDocumentoModal documento={docSel} onCerrar={() => setDocSel(null)} />
    </div>
  );
}

function toInputLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromInputLocal(value: string): string {
  return new Date(value).toISOString();
}
