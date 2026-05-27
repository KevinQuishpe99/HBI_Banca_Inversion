'use client';

import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

/** Círculo con número de paso (visible en diagrama y alineado con el formulario) */
function StepNum({ n }: { n: number }) {
  return (
    <span className="mb-1 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border-2 border-gray-800 bg-gray-100 px-1.5 text-[11px] font-bold text-gray-900 shadow-sm">
      {n}
    </span>
  );
}

function NodeTerminal({ children, variant = 'start', step }: { children: ReactNode; variant?: 'start' | 'end'; step?: number }) {
  void variant;
  return (
    <div className="flex shrink-0 flex-col items-center">
      {step != null ? <StepNum n={step} /> : null}
      <div className="rounded-full border-2 border-gray-900 bg-gray-100 px-3 py-2 text-center text-xs font-bold text-gray-900 shadow-sm">
        {children}
      </div>
    </div>
  );
}

function NodeProcess({
  children,
  accent,
  step,
}: {
  children: ReactNode;
  accent?: 'blue' | 'rose' | 'violet';
  step: number;
}) {
  const cls =
    accent === 'rose'
      ? 'border-rose-400 bg-rose-50 text-gray-900'
      : accent === 'violet'
        ? 'border-violet-400 bg-violet-50 text-gray-900'
        : 'border-blue-500 bg-blue-50 text-gray-900';
  return (
    <div className="flex shrink-0 flex-col items-center">
      <StepNum n={step} />
      <div
        className={`rounded-md border-2 px-2.5 pb-2 pt-1.5 text-center text-[11px] font-semibold leading-tight shadow-sm sm:min-w-[5.5rem] sm:max-w-[8rem] ${cls}`}
      >
        {children}
      </div>
    </div>
  );
}

function Arrow({ label }: { label?: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center self-end pb-6 text-gray-800">
      <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2} />
      {label ? <span className="max-w-[3rem] text-center text-[9px] font-medium text-gray-900">{label}</span> : null}
    </div>
  );
}

/**
 * Flujo 1: pasos alineados con el formulario — Paso 1 orígenes, Paso 3 área supervisión.
 */
export function SupervisionChainFlowDiagram({ supervisionAreaLabel }: { supervisionAreaLabel?: string }) {
  const sup = supervisionAreaLabel?.trim() || 'Área supervisión';
  return (
    <div className="w-full">
      <div className="overflow-x-auto rounded-xl border border-violet-100 bg-white/60 px-3 py-5 shadow-inner">
        <div className="flex min-w-[min(100%,960px)] flex-wrap items-end justify-center gap-x-0.5 gap-y-4 sm:flex-nowrap sm:justify-start">
          <NodeTerminal variant="start">Inicio</NodeTerminal>
          <Arrow />
          <NodeProcess step={1} accent="violet">
            Orígenes
            <br />
            <span className="text-[10px] font-medium text-gray-800">(config. admin)</span>
          </NodeProcess>
          <Arrow />
          <NodeProcess step={2}>Usuario sube trámite</NodeProcess>
          <Arrow />
          <NodeProcess step={3} accent="rose">
            Supervisión
            <br />
            <span className="text-[10px] font-medium text-gray-800">({sup})</span>
          </NodeProcess>
          <Arrow />
          <NodeProcess step={4}>
            Elige áreas
            <br />
            de revisión
          </NodeProcess>
          <Arrow />
          <NodeProcess step={5}>Revisiones por áreas</NodeProcess>
          <Arrow />
          <NodeProcess step={6}>Legal</NodeProcess>
          <Arrow />
          <NodeProcess step={7}>Director general</NodeProcess>
          <Arrow />
          <NodeTerminal variant="end" step={8}>
            Fin
          </NodeTerminal>
        </div>
      </div>
    </div>
  );
}

/**
 * Flujo 2: paso 1 = orígenes en formulario.
 */
export function DirectLegalFlowDiagram() {
  return (
    <div className="w-full">
      <div className="overflow-x-auto rounded-xl border border-sky-100 bg-white/60 px-3 py-5 shadow-inner">
        <div className="flex min-w-[min(100%,720px)] flex-wrap items-end justify-center gap-x-0.5 gap-y-4 sm:flex-nowrap sm:justify-start">
          <NodeTerminal variant="start">Inicio</NodeTerminal>
          <Arrow />
          <NodeProcess step={1} accent="violet">
            Orígenes
            <br />
            <span className="text-[10px] font-medium text-gray-800">(config. admin)</span>
          </NodeProcess>
          <Arrow />
          <NodeProcess step={2}>Usuario sube trámite</NodeProcess>
          <Arrow />
          <NodeProcess step={3} accent="rose">
            Legal
          </NodeProcess>
          <Arrow />
          <NodeProcess step={4}>Director general</NodeProcess>
          <Arrow />
          <NodeTerminal variant="end" step={5}>
            Fin
          </NodeTerminal>
        </div>
      </div>
    </div>
  );
}
