'use client';

import { useMemo, useState } from 'react';
import { Calculator, AlertTriangle, CheckCircle2, TrendingDown } from 'lucide-react';
import type { OperacionCredito } from '@/types/hbi/operacion.types';
import {
  calcularEscenariosSimulador,
  formatearRatio,
  parametrosDesdeOperacion,
} from '@/lib/hbi/simulador-financiero';
import { formatearMonto } from '@/lib/hbi/hitos-plantilla';
import { UMBRALES_COVENANT } from '@/types/hbi/simulador.types';
import type { ParametrosSimuladorHbi, ResultadoEscenarioHbi } from '@/types/hbi/simulador.types';

type Props = {
  operacionId: string;
  codigoOperacion: string;
  metadata: OperacionCredito['metadata'];
};

const SEMAFORO_STYLE = {
  VERDE: 'border-emerald-200 bg-emerald-50',
  AMBAR: 'border-amber-200 bg-amber-50',
  ROJO: 'border-red-200 bg-red-50',
} as const;

export function SimuladorFinancieroPanel({ codigoOperacion, metadata }: Props) {
  const iniciales = useMemo(() => parametrosDesdeOperacion(metadata), [metadata]);
  const [params, setParams] = useState<ParametrosSimuladorHbi>(iniciales);
  const escenarios = useMemo(() => calcularEscenariosSimulador(params), [params]);

  const actualizar = (campo: keyof ParametrosSimuladorHbi, valor: number) => {
    setParams((p) => ({ ...p, [campo]: valor }));
  };

  const escenarioPeor = escenarios.reduce((peor, e) =>
    e.semaforo === 'ROJO' || (e.semaforo === 'AMBAR' && peor.semaforo === 'VERDE') ? e : peor
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-900">Simulador financiero — Anexo 3</h3>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Modelo interactivo para comité de crédito: recalcula DSCR, leverage y LLCR bajo escenarios
          base y de estrés ({codigoOperacion}). Los umbrales coinciden con los covenants del crédito.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-900">Parámetros del modelo</h4>
          <div className="mt-4 space-y-4">
            <CampoSlider
              label="Monto total aprobado"
              valor={params.montoTotal}
              min={1_000_000}
              max={500_000_000}
              step={1_000_000}
              formato={(v) => formatearMonto(v, params.moneda)}
              onChange={(v) => actualizar('montoTotal', v)}
            />
            <CampoSlider
              label="Saldo desembolsado"
              valor={params.desembolsado}
              min={0}
              max={params.montoTotal}
              step={500_000}
              formato={(v) => formatearMonto(v, params.moneda)}
              onChange={(v) => actualizar('desembolsado', v)}
            />
            <CampoSlider
              label="Tasa referencia (SOFR %)"
              valor={params.tasaReferenciaPct}
              min={1}
              max={8}
              step={0.05}
              formato={(v) => `${v.toFixed(2)}%`}
              onChange={(v) => actualizar('tasaReferenciaPct', v)}
            />
            <CampoSlider
              label="Spread (bps)"
              valor={params.spreadBps}
              min={100}
              max={500}
              step={5}
              formato={(v) => `${v} bps`}
              onChange={(v) => actualizar('spreadBps', v)}
            />
            <CampoSlider
              label="Plazo (años)"
              valor={params.plazoAnios}
              min={3}
              max={20}
              step={1}
              formato={(v) => `${v} años`}
              onChange={(v) => actualizar('plazoAnios', v)}
            />
            <CampoSlider
              label="EBITDA anual proyectado"
              valor={params.ebitdaAnual}
              min={1_000_000}
              max={120_000_000}
              step={500_000}
              formato={(v) => formatearMonto(v, params.moneda)}
              onChange={(v) => actualizar('ebitdaAnual', v)}
            />
            <CampoSlider
              label="Meses de retraso (escenario)"
              valor={params.mesesRetraso}
              min={0}
              max={18}
              step={1}
              formato={(v) => `${v} meses`}
              onChange={(v) => actualizar('mesesRetraso', v)}
            />
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Tasa all-in simulada: {(params.tasaReferenciaPct + params.spreadBps / 100).toFixed(2)}% ·
            Umbrales: DSCR ≥ {UMBRALES_COVENANT.dscrMin}x · Leverage ≤ {UMBRALES_COVENANT.leverageMax}x ·
            LLCR ≥ {UMBRALES_COVENANT.llcrMin}x
          </p>
        </section>

        <section className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-5">
          <h4 className="text-sm font-semibold text-slate-900">¿Cómo se calcula?</h4>
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-slate-700">
            <li>
              <strong>Servicio de deuda</strong> = intereses sobre saldo vigente + amortización lineal
              (monto / plazo).
            </li>
            <li>
              <strong>DSCR</strong> = EBITDA ÷ servicio de deuda. Mide si el flujo cubre cuotas e
              intereses.
            </li>
            <li>
              <strong>Leverage</strong> = saldo vigente ÷ EBITDA. Apalancamiento del proyecto.
            </li>
            <li>
              <strong>LLCR</strong> (aprox.) = flujo descontado de vida del crédito ÷ saldo. Cobertura
              a largo plazo.
            </li>
          </ol>
          <div className="mt-4 rounded-lg border border-indigo-200 bg-white p-3 text-sm">
            <p className="font-medium text-indigo-900">Escenario más exigente ahora</p>
            <p className="mt-1 text-slate-700">{escenarioPeor.nombre}: {escenarioPeor.descripcion}</p>
            <p className="mt-2 font-mono text-indigo-800">
              DSCR {formatearRatio(escenarioPeor.dscr)} · Leverage {formatearRatio(escenarioPeor.leverage)} ·
              LLCR {formatearRatio(escenarioPeor.llcr)}
            </p>
          </div>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {escenarios.map((e) => (
          <TarjetaEscenario key={e.id} escenario={e} moneda={params.moneda} />
        ))}
      </div>
    </div>
  );
}

function CampoSlider({
  label,
  valor,
  min,
  max,
  step,
  formato,
  onChange,
}: {
  label: string;
  valor: number;
  min: number;
  max: number;
  step: number;
  formato: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="font-mono text-slate-900">{formato(valor)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={valor}
        onChange={(ev) => onChange(Number(ev.target.value))}
        className="mt-2 w-full accent-indigo-600"
        aria-label={label}
      />
    </div>
  );
}

function TarjetaEscenario({
  escenario,
  moneda,
}: {
  escenario: ResultadoEscenarioHbi;
  moneda: 'USD' | 'COP';
}) {
  const Icon =
    escenario.semaforo === 'VERDE'
      ? CheckCircle2
      : escenario.semaforo === 'ROJO'
        ? TrendingDown
        : AlertTriangle;

  return (
    <article className={`rounded-xl border p-4 ${SEMAFORO_STYLE[escenario.semaforo]}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">{escenario.nombre}</p>
          <p className="mt-0.5 text-xs text-slate-600">{escenario.descripcion}</p>
        </div>
        <Icon
          className={[
            'h-5 w-5 shrink-0',
            escenario.semaforo === 'VERDE'
              ? 'text-emerald-600'
              : escenario.semaforo === 'ROJO'
                ? 'text-red-600'
                : 'text-amber-600',
          ].join(' ')}
        />
      </div>
      <dl className="mt-3 space-y-1.5 text-sm">
        <MetricaCovenant label="DSCR" valor={formatearRatio(escenario.dscr)} cumple={escenario.cumpleDscr} min={`≥ ${UMBRALES_COVENANT.dscrMin}x`} />
        <MetricaCovenant label="Leverage" valor={formatearRatio(escenario.leverage)} cumple={escenario.cumpleLeverage} min={`≤ ${UMBRALES_COVENANT.leverageMax}x`} />
        <MetricaCovenant label="LLCR" valor={formatearRatio(escenario.llcr)} cumple={escenario.cumpleLlcr} min={`≥ ${UMBRALES_COVENANT.llcrMin}x`} />
        <div className="border-t border-slate-200/80 pt-2 text-xs text-slate-600">
          Servicio deuda: {formatearMonto(escenario.servicioDeudaAnual, moneda)}/año · Tasa{' '}
          {escenario.tasaEfectivaPct.toFixed(2)}%
        </div>
      </dl>
    </article>
  );
}

function MetricaCovenant({
  label,
  valor,
  cumple,
  min,
}: {
  label: string;
  valor: string;
  cumple: boolean;
  min: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">
        {label} <span className="text-xs text-slate-400">({min})</span>
      </span>
      <span className={`font-mono font-semibold ${cumple ? 'text-emerald-700' : 'text-red-700'}`}>
        {valor}
        {cumple ? null : ' ✗'}
      </span>
    </div>
  );
}
