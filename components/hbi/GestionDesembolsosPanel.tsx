'use client';

import { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Lock,
  Shield,
  Calculator,
  Upload,
  Wallet,
} from 'lucide-react';
import {
  useActualizarHitoDesembolso,
  useEjecutarDesembolso,
  useHbiHitos,
  useMarcarChecklistHito,
  useSubirEvidenciaHito,
} from '@/hooks/useHbiDesembolsos';
import { DesembolsosEvidenciaPanel } from '@/components/hbi/DesembolsosEvidenciaPanel';
import {
  calcularAvanceDesembolsos,
  evaluarRequisitosHito,
  hitoAnteriorCompleto,
  labelAnexoChecklist,
  labelEstadoHito,
  labelFaseProyecto,
  normalizarHitoDesembolso,
  ordenarHitos,
  puedeEjecutarDesembolso,
  FASES_PROYECTO_HBI,
} from '@/lib/hbi/desembolsos-domain';
import { formatearMonto, fechaInputDesdeIso, isoDesdeFechaInput } from '@/lib/hbi/hitos-plantilla';
import { AGENTE_FINANCIACION_HBI, TIPOS_SERVICIO_LABEL } from '@/types/hbi/operacion.types';
import type { TipoServicioHbi } from '@/types/hbi/operacion.types';
import type { EvidenciaDesembolsoHbi, HitoDesembolsoHbi } from '@/types/hbi/cliente.types';

type Props = {
  operacionId: string;
  montoTotal: number;
  moneda: 'USD' | 'COP';
  serviciosActivos: TipoServicioHbi[];
};

const ANEXO_UPLOAD: Array<{
  anexo: EvidenciaDesembolsoHbi['anexoRequerido'];
  servicio: TipoServicioHbi;
  icon: typeof FileText;
  color: string;
}> = [
  {
    anexo: 'ANEXO_1',
    servicio: 'ANEXO_1_ADMINISTRATIVO',
    icon: FileText,
    color: 'text-blue-700 border-blue-200 bg-blue-50',
  },
  {
    anexo: 'ANEXO_2',
    servicio: 'ANEXO_2_GARANTIAS',
    icon: Shield,
    color: 'text-violet-700 border-violet-200 bg-violet-50',
  },
  {
    anexo: 'ANEXO_3',
    servicio: 'ANEXO_3_CALCULO',
    icon: Calculator,
    color: 'text-emerald-700 border-emerald-200 bg-emerald-50',
  },
];

export function GestionDesembolsosPanel({
  operacionId,
  montoTotal,
  moneda,
  serviciosActivos,
}: Props) {
  const { data: hitosRaw, isLoading } = useHbiHitos(operacionId);
  const subir = useSubirEvidenciaHito(operacionId);
  const checklist = useMarcarChecklistHito(operacionId);
  const actualizar = useActualizarHitoDesembolso(operacionId);
  const ejecutar = useEjecutarDesembolso(operacionId);
  const [error, setError] = useState<string | null>(null);

  if (isLoading || !hitosRaw?.length) {
    return isLoading ? (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    ) : null;
  }

  const hitos = ordenarHitos(hitosRaw.map(normalizarHitoDesembolso));
  const avance = calcularAvanceDesembolsos(hitos);

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Wallet className="h-6 w-6 text-indigo-700" />
              <h2 className="text-lg font-semibold text-slate-900">Control de desembolsos por proyecto</h2>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">{AGENTE_FINANCIACION_HBI}</p>
            <p className="mt-2 text-xs text-slate-500">
              Cada desembolso requiere evidencias documentales por los servicios contratados (Anexos 1, 2
              y 3) antes de ejecutar el giro y habilitar el siguiente.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-indigo-100">
              <p className="text-xs text-slate-500">% desembolsado</p>
              <p className="text-xl font-bold text-indigo-800">{avance.porcentajeEjecutado}%</p>
            </div>
            <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-indigo-100">
              <p className="text-xs text-slate-500">Monto ejecutado</p>
              <p className="font-mono font-semibold text-emerald-700">
                {formatearMonto(avance.montoEjecutado, moneda)}
              </p>
            </div>
            <div className="col-span-2 rounded-lg bg-white px-3 py-2 ring-1 ring-indigo-100 sm:col-span-1">
              <p className="text-xs text-slate-500">Fase del proyecto</p>
              <p className="font-medium text-slate-900">{labelFaseProyecto(avance.faseActual)}</p>
            </div>
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-indigo-600 transition-all"
            style={{ width: `${avance.porcentajeEjecutado}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-slate-600">
          {avance.desembolsosCompletados} de {avance.totalDesembolsos} desembolsos ejecutados
          {avance.hitoActivo ? ` · Activo: ${avance.hitoActivo.id} — ${avance.hitoActivo.nombre}` : ''}
        </p>
      </header>

      <div className="space-y-4">
        {hitos.map((hito, index) => (
          <HitoDesembolsoCard
            key={hito.id}
            hito={hito}
            hitos={hitos}
            index={index}
            total={hitos.length}
            moneda={moneda}
            serviciosActivos={serviciosActivos}
            bloqueado={!hitoAnteriorCompleto(hitos, hito.id)}
            onError={setError}
            subir={subir}
            checklist={checklist}
            actualizar={actualizar}
            ejecutar={ejecutar}
          />
        ))}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <DesembolsosEvidenciaPanel hitos={hitos} montoTotal={montoTotal} moneda={moneda} compacto />
    </div>
  );
}

function HitoDesembolsoCard({
  hito,
  hitos,
  index,
  total,
  moneda,
  serviciosActivos,
  bloqueado,
  onError,
  subir,
  checklist,
  actualizar,
  ejecutar,
}: {
  hito: HitoDesembolsoHbi;
  hitos: HitoDesembolsoHbi[];
  index: number;
  total: number;
  moneda: 'USD' | 'COP';
  serviciosActivos: TipoServicioHbi[];
  bloqueado: boolean;
  onError: (msg: string | null) => void;
  subir: ReturnType<typeof useSubirEvidenciaHito>;
  checklist: ReturnType<typeof useMarcarChecklistHito>;
  actualizar: ReturnType<typeof useActualizarHitoDesembolso>;
  ejecutar: ReturnType<typeof useEjecutarDesembolso>;
}) {
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  const completado = hito.estado === 'COMPLETADO';
  const req = evaluarRequisitosHito(hito, serviciosActivos);
  const puede =
    !bloqueado &&
    !completado &&
    puedeEjecutarDesembolso(hitos, hito.id, serviciosActivos).permitido;

  const onUpload = async (
    anexo: EvidenciaDesembolsoHbi['anexoRequerido'],
    files: FileList | null
  ) => {
    if (!files?.[0]) return;
    onError(null);
    try {
      await subir.mutateAsync({
        hitoId: hito.id,
        file: files[0],
        anexoRequerido: anexo,
      });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Error al subir evidencia');
    }
  };

  const onEjecutar = async () => {
    onError(null);
    try {
      await ejecutar.mutateAsync(hito.id);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'No se pudo ejecutar');
    }
  };

  return (
    <article
      className={[
        'rounded-xl border p-5 shadow-sm',
        completado
          ? 'border-emerald-200 bg-emerald-50/30'
          : bloqueado
            ? 'border-slate-200 bg-slate-50 opacity-90'
            : 'border-indigo-100 bg-white',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
            Desembolso {index + 1} de {total} · {hito.id}
          </p>
          <h3 className="text-lg font-semibold text-slate-900">{hito.nombre}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {hito.porcentaje}% · {formatearMonto(hito.monto, moneda)} ·{' '}
            {labelFaseProyecto(hito.faseProyecto)}
          </p>
          {hito.fechaDesembolsoEjecutado ? (
            <p className="mt-1 text-sm font-medium text-emerald-700">
              Desembolsado el{' '}
              {new Date(hito.fechaDesembolsoEjecutado).toLocaleDateString('es-CO', {
                dateStyle: 'long',
              })}
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-500">
              Programado:{' '}
              {new Date(hito.fechaObjetivo).toLocaleDateString('es-CO', { dateStyle: 'long' })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {bloqueado && !completado ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700">
              <Lock className="h-3.5 w-3.5" />
              Bloqueado
            </span>
          ) : null}
          {completado ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Desembolsado
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
              {labelEstadoHito(hito.estado)}
            </span>
          )}
        </div>
      </div>

      {bloqueado && !completado ? (
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600">
          <Lock className="h-4 w-4 shrink-0" />
          Complete y ejecute el desembolso anterior para habilitar este hito.
        </p>
      ) : null}

      {!completado && !bloqueado ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs font-medium text-indigo-800">
            Ajuste el plan tras cargar documentación contractual (editable hasta ejecutar el giro).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-600">Nombre del desembolso / fase</label>
              <input
                defaultValue={hito.nombre}
                onBlur={(e) => {
                  if (e.target.value === hito.nombre) return;
                  void actualizar.mutateAsync({
                    hitoId: hito.id,
                    patch: { nombre: e.target.value },
                  });
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Porcentaje %</label>
              <input
                type="number"
                min={1}
                max={100}
                defaultValue={hito.porcentaje}
                onBlur={(e) => {
                  const pct = Number(e.target.value) || hito.porcentaje;
                  if (pct === hito.porcentaje) return;
                  void actualizar.mutateAsync({
                    hitoId: hito.id,
                    patch: { porcentaje: pct },
                  });
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Fecha programada</label>
              <input
                type="date"
                defaultValue={fechaInputDesdeIso(hito.fechaObjetivo)}
                onBlur={(e) => {
                  const iso = isoDesdeFechaInput(e.target.value);
                  if (iso === hito.fechaObjetivo) return;
                  void actualizar.mutateAsync({
                    hitoId: hito.id,
                    patch: { fechaObjetivo: iso },
                  });
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Descripción de la fase del proyecto</label>
            <textarea
              rows={2}
              defaultValue={hito.descripcionFase ?? ''}
              onBlur={(e) => {
                if (e.target.value === hito.descripcionFase) return;
                void actualizar.mutateAsync({
                  hitoId: hito.id,
                  patch: { descripcionFase: e.target.value },
                });
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Qué ocurre en el proyecto en este desembolso..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Fase del proyecto</label>
            <select
              value={hito.faseProyecto ?? ''}
              onChange={(e) =>
                void actualizar.mutateAsync({
                  hitoId: hito.id,
                  patch: { faseProyecto: e.target.value },
                })
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {FASES_PROYECTO_HBI.map((f) => (
                <option key={f.codigo} value={f.codigo}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        hito.descripcionFase ? (
          <p className="mt-3 text-sm text-slate-700">{hito.descripcionFase}</p>
        ) : null
      )}

      {!bloqueado ? (
        <>
          <div className="mt-4">
            <p className="text-sm font-medium text-slate-800">Evidencias documentales por servicio HBI</p>
            <p className="text-xs text-slate-500">
              Suba un archivo por cada Anexo contratado para habilitar el desembolso.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {ANEXO_UPLOAD.filter((a) => serviciosActivos.includes(a.servicio)).map((a) => {
                const Icon = a.icon;
                const tiene = (hito.evidencias ?? []).some((e) => e.anexoRequerido === a.anexo);
                return (
                  <div key={a.anexo} className={`rounded-lg border p-3 ${a.color}`}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span className="text-xs font-semibold">{TIPOS_SERVICIO_LABEL[a.servicio]}</span>
                    </div>
                    {tiene ? (
                      <ul className="mt-2 space-y-1 text-xs">
                        {(hito.evidencias ?? [])
                          .filter((e) => e.anexoRequerido === a.anexo)
                          .map((e) => (
                            <li key={e.id} className="truncate font-medium">
                              ✓ {e.nombreArchivo}
                            </li>
                          ))}
                      </ul>
                    ) : (
                      <>
                        <input
                          ref={(el) => {
                            refs.current[a.anexo] = el;
                          }}
                          type="file"
                          className="hidden"
                          onChange={(e) => void onUpload(a.anexo, e.target.files)}
                        />
                        <button
                          type="button"
                          disabled={subir.isPending || completado}
                          onClick={() => refs.current[a.anexo]?.click()}
                          className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-md border border-current/30 bg-white/80 px-2 py-1.5 text-xs font-medium disabled:opacity-50"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Subir evidencia
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium text-slate-800">Checklist documental</p>
            <ul className="mt-2 space-y-1">
              {hito.checklistDocumental.map((c, i) => {
                const anexoLabel = labelAnexoChecklist(c.anexo);
                return (
                <li key={`${c.item}-${i}`} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={c.cumplido}
                    disabled={completado || checklist.isPending}
                    onChange={(e) =>
                      void checklist.mutateAsync({
                        hitoId: hito.id,
                        itemIndex: i,
                        cumplido: e.target.checked,
                      })
                    }
                    className="mt-0.5 rounded border-slate-300"
                  />
                  <span className={c.cumplido ? 'text-slate-500 line-through' : 'text-slate-800'}>
                    {c.item}
                    {anexoLabel ? (
                      <span className="ml-1 text-xs text-slate-400">({anexoLabel})</span>
                    ) : null}
                  </span>
                </li>
              );
              })}
            </ul>
          </div>

          {!completado ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
              {!req.listo ? (
                <p className="flex items-center gap-1 text-xs text-amber-700">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Falta: {req.faltantes[0]}
                </p>
              ) : null}
              <button
                type="button"
                disabled={!puede || ejecutar.isPending}
                onClick={() => void onEjecutar()}
                className="ml-auto inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {ejecutar.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Registrar desembolso ({hito.porcentaje}%)
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </article>
  );
}
