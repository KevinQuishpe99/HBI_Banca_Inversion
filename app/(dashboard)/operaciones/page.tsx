'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Filter, Kanban, List } from 'lucide-react';
import { useHbiOperaciones } from '@/hooks/useHbiOperaciones';
import { OperacionListItem } from '@/components/hbi/OperacionListItem';
import { PipelineKanban } from '@/components/hbi/PipelineKanban';
import { FASES_WORKFLOW, type FaseWorkflowHbi } from '@/types/hbi/operacion.types';
import { MockModeBanner } from '@/components/hbi/MockModeBanner';

export default function OperacionesPage() {
  const [faseFiltro, setFaseFiltro] = useState<FaseWorkflowHbi | ''>('');
  const [vista, setVista] = useState<'lista' | 'kanban'>('lista');
  const { data, isLoading, error } = useHbiOperaciones(faseFiltro || undefined);

  return (
    <div className="space-y-6">
      <MockModeBanner />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-700">HBI · Agente de Financiación</p>
          <h1 className="text-2xl font-bold text-slate-900">Operaciones de crédito</h1>
          <p className="mt-1 text-slate-600">
            Gestión del workflow en 4 fases: contratos, correos, expediente y seguimiento.
          </p>
        </div>
        <Link
          href="/operaciones/nueva"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          Nueva operación
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-slate-500" aria-hidden />
        <select
          value={faseFiltro}
          onChange={(e) => setFaseFiltro(e.target.value as FaseWorkflowHbi | '')}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          aria-label="Filtrar por fase"
        >
          <option value="">Todas las fases</option>
          {FASES_WORKFLOW.map((f) => (
            <option key={f.codigo} value={f.codigo}>
              {f.titulo}
            </option>
          ))}
        </select>
        <div className="ml-auto flex rounded-lg border border-slate-200 p-0.5">
          <button
            type="button"
            onClick={() => setVista('lista')}
            className={[
              'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium',
              vista === 'lista' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50',
            ].join(' ')}
          >
            <List className="h-4 w-4" />
            Lista
          </button>
          <button
            type="button"
            onClick={() => setVista('kanban')}
            className={[
              'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium',
              vista === 'kanban' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50',
            ].join(' ')}
          >
            <Kanban className="h-4 w-4" />
            Kanban
          </button>
        </div>
      </div>

      {vista === 'kanban' && !faseFiltro ? <PipelineKanban /> : null}

      {vista === 'lista' || faseFiltro ? (
        <>
      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error.message}</div>
      ) : null}

      {data && data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-600">
          No hay operaciones registradas. Inicie con Fase 1 — ingreso de contratos.
        </div>
      ) : null}

      <div className="space-y-3">
        {data?.map((op) => (
          <OperacionListItem key={op.id} operacion={op} />
        ))}
      </div>
        </>
      ) : null}
    </div>
  );
}
