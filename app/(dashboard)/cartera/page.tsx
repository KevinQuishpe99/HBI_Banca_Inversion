'use client';

import { MockModeBanner } from '@/components/hbi/MockModeBanner';
import { CarteraRiesgosView } from '@/components/hbi/CovenantsPanel';
import { DashboardEjecutivoHbi } from '@/components/hbi/DashboardEjecutivoHbi';

export default function CarteraPage() {
  return (
    <div className="space-y-8">
      <MockModeBanner />
      <div>
        <p className="text-sm font-medium text-blue-700">HBI · Risk & portfolio</p>
        <h1 className="text-2xl font-bold text-slate-900">Cartera de riesgos</h1>
        <p className="mt-1 max-w-2xl text-slate-600">
          Consolidado de covenants, comités y obligaciones across deals — panel típico de loan agency /
          investment banking back-office.
        </p>
      </div>
      <DashboardEjecutivoHbi />
      <CarteraRiesgosView />
    </div>
  );
}
