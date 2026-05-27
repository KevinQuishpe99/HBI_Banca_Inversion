'use client';

import Link from 'next/link';
import { Landmark, FileText, Mail, FolderOpen, ListChecks, Plus, Loader2 } from 'lucide-react';
import { useHbiOperaciones } from '@/hooks/useHbiOperaciones';
import { FASES_WORKFLOW } from '@/types/hbi/operacion.types';
import { OperacionListItem } from '@/components/hbi/OperacionListItem';
import { MockModeBanner } from '@/components/hbi/MockModeBanner';
import { ServiciosHbiInfoCard } from '@/components/hbi/ServiciosHbiInfoCard';
import { DashboardEjecutivoHbi } from '@/components/hbi/DashboardEjecutivoHbi';
import { GuiaDemoHbi } from '@/components/hbi/GuiaDemoHbi';

const FASE_ICONS = [FileText, Mail, FolderOpen, ListChecks] as const;

export default function DashboardPage() {
  const { data: operaciones, isLoading, error } = useHbiOperaciones();

  const porFase = FASES_WORKFLOW.map((f) => ({
    ...f,
    count: operaciones?.filter((o) => o.faseActual === f.codigo).length ?? 0,
  }));

  return (
    <div className="space-y-8">
      <MockModeBanner />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-wide text-[var(--color-brand-primary)]">
            Helm Banca de Inversión
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Agente de Financiación</h1>
          <p className="mt-1 max-w-2xl text-slate-600">
            Herramienta de gestión y control para créditos sindicados: contratos, correos,
            expediente maestro y seguimiento por Anexos 1, 2 y 3.
          </p>
        </div>
        <Link
          href="/operaciones/nueva"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 text-white hover:bg-[var(--color-brand-primary-hover)]"
        >
          <Plus className="h-5 w-5" />
          Nueva operación
        </Link>
      </div>

      <DashboardEjecutivoHbi />

      <GuiaDemoHbi />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {porFase.map((fase, i) => {
          const Icon = FASE_ICONS[i] ?? FileText;
          return (
            <div
              key={fase.codigo}
              className="rounded-xl border border-[var(--color-brand-border)] bg-white p-5 shadow-sm"
            >
              <div className="flex items-center gap-2 text-[var(--color-brand-primary)]">
                <Icon className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase">Fase {i + 1}</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{fase.count}</p>
              <p className="mt-1 text-sm text-slate-600">{fase.titulo.replace(/^Fase \d+ — /, '')}</p>
            </div>
          );
        })}
      </div>

      <ServiciosHbiInfoCard />

      <section className="rounded-xl border border-[var(--color-brand-border)] bg-gradient-to-br from-[var(--color-brand-accent)]/50 to-white p-6">
        <div className="flex items-center gap-3">
          <Landmark className="h-8 w-8 text-[var(--color-brand-primary)]" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Flujo operativo</h2>
            <p className="text-sm text-slate-600">
              Ingreso de contratos → Registro de correos → Expediente 360 → Seguimiento por
              servicio
            </p>
          </div>
        </div>
        <Link
          href="/operaciones"
          className="mt-4 inline-block text-sm font-medium text-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary-hover)]"
        >
          Ver todas las operaciones →
        </Link>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Operaciones recientes</h2>
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--color-brand-primary)]" />
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
            {error.message}
          </div>
        ) : null}
        <div className="space-y-3">
          {operaciones?.slice(0, 5).map((op) => (
            <OperacionListItem key={op.id} operacion={op} />
          ))}
          {operaciones?.length === 0 && !isLoading && !error ? (
            <p className="text-slate-500">Sin operaciones. Cree la primera en Fase 1.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
