'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { MockModeBanner } from '@/components/hbi/MockModeBanner';
import { PipelineKanban } from '@/components/hbi/PipelineKanban';

export default function PipelinePage() {
  return (
    <div className="space-y-6">
      <MockModeBanner />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-700">HBI · Deal pipeline</p>
          <h1 className="text-2xl font-bold text-slate-900">Pipeline comercial</h1>
          <p className="mt-1 max-w-2xl text-slate-600">
            Vista Kanban por fase del workflow sindicado — desde ingreso contractual hasta seguimiento
            post-desembolso.
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
      <PipelineKanban />
    </div>
  );
}
