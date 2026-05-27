'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import {
  useHbiOperacionVista360,
  useAvanzarFaseHbi,
  useHbiEstadoIntegral,
} from '@/hooks/useHbiOperaciones';
import { FaseWorkflowStepper } from '@/components/hbi/FaseWorkflowStepper';
import { EstadoIntegralBanner } from '@/components/hbi/EstadoIntegralBanner';
import { OperacionWorkflowTabs } from '@/components/hbi/OperacionWorkflowTabs';
import { FASES_WORKFLOW, type FaseWorkflowHbi } from '@/types/hbi/operacion.types';
import { MockModeBanner } from '@/components/hbi/MockModeBanner';
import { formatearMonto } from '@/lib/hbi/hitos-plantilla';
import { GestionDesembolsosPanel } from '@/components/hbi/GestionDesembolsosPanel';
import type { EstructuraFinancieraHbi, HitoDesembolsoHbi } from '@/types/hbi/cliente.types';
import type { InfoProyectoHbi } from '@/types/hbi/operacion.types';

const ORDEN: FaseWorkflowHbi[] = [
  'FASE_1_CONTRATOS',
  'FASE_2_CORREOS',
  'FASE_3_EXPEDIENTE',
  'FASE_4_SEGUIMIENTO',
];

export default function OperacionDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading, error } = useHbiOperacionVista360(id);
  const { data: estado, isLoading: loadingEstado } = useHbiEstadoIntegral(id);
  const avanzar = useAvanzarFaseHbi(id);

  const siguienteFase = (): FaseWorkflowHbi | null => {
    if (!data) return null;
    const i = ORDEN.indexOf(data.faseActual);
    return i < ORDEN.length - 1 ? ORDEN[i + 1] : null;
  };

  const next = siguienteFase();
  const puedeAvanzar = estado?.puedeAvanzarFase ?? false;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        {error?.message ?? 'Operación no encontrada'}
      </div>
    );
  }

  const estructura = data.metadata?.estructuraFinanciera as EstructuraFinancieraHbi | undefined;
  const infoProyecto = data.metadata?.infoProyecto as InfoProyectoHbi | undefined;
  const hitos = (data.metadata?.hitosDesembolso ?? []) as HitoDesembolsoHbi[];
  const montoTotal = estructura?.montoTotal ?? hitos.reduce((s, h) => s + (h.monto ?? 0), 0);
  const moneda = estructura?.moneda ?? 'USD';

  return (
    <div className="space-y-8">
      <MockModeBanner />
      <div>
        <Link
          href="/operaciones"
          className="inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Operaciones
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-sm text-slate-500">{data.codigoOperacion}</p>
            <h1 className="text-2xl font-bold text-slate-900">{data.nombreCredito}</h1>
            {data.deudor ? <p className="text-slate-600">Deudor: {data.deudor}</p> : null}
            {estructura ? (
              <p className="text-sm font-medium text-[var(--color-brand-primary)]">
                Monto: {formatearMonto(estructura.montoTotal, estructura.moneda)}
                {estructura.acreedores?.length
                  ? ` · Sindicado: ${estructura.acreedores.map((a) => a.razonSocial).join(', ')}`
                  : ''}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-slate-500">
              Expediente maestro activo desde la creación · Agente: {data.agenteFinanciacion}
            </p>
            {infoProyecto?.responsableNombre ? (
              <p className="mt-2 text-sm text-teal-800">
                PMO: {infoProyecto.responsableNombre}
                {infoProyecto.viabilidad && infoProyecto.viabilidad !== 'EN_EVALUACION'
                  ? ` · Viabilidad: ${infoProyecto.viabilidad.replace(/_/g, ' ')}`
                  : ''}
              </p>
            ) : null}
          </div>
          {next ? (
            <button
              type="button"
              disabled={avanzar.isPending || !puedeAvanzar}
              title={!puedeAvanzar ? estado?.mensajeAvance : undefined}
              onClick={() =>
                avanzar.mutate({
                  fase: next,
                  comentario: `Avance validado a ${FASES_WORKFLOW.find((f) => f.codigo === next)?.titulo}`,
                })
              }
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {avanzar.isPending
                ? 'Validando…'
                : `Avanzar a ${FASES_WORKFLOW.find((f) => f.codigo === next)?.titulo.split('—')[1]?.trim()}`}
            </button>
          ) : (
            <span className="rounded-lg bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
              Fase 4 — Motor operativo activo
            </span>
          )}
        </div>
      </div>

      <EstadoIntegralBanner estado={estado} isLoading={loadingEstado} />

      {hitos.length > 0 ? (
        <GestionDesembolsosPanel
          operacionId={data.id}
          montoTotal={montoTotal}
          moneda={moneda}
          serviciosActivos={data.serviciosActivos}
        />
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Progreso del workflow</h2>
        <FaseWorkflowStepper faseActual={data.faseActual} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Gestión por fase</h2>
        <OperacionWorkflowTabs data={data} faseSugerida={data.faseActual} />
      </section>
    </div>
  );
}
