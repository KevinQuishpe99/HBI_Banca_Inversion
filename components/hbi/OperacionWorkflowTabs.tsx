'use client';

import { useState } from 'react';
import type { FaseWorkflowHbi, OperacionVista360 } from '@/types/hbi/operacion.types';
import { Fase1DocumentosPanel } from '@/components/hbi/Fase1DocumentosPanel';
import { CorreosBandejaCompleta } from '@/components/hbi/CorreosBandejaCompleta';
import { TrazabilidadTimeline } from '@/components/hbi/TrazabilidadTimeline';
import { Fase4ActividadesPanel } from '@/components/hbi/Fase4ActividadesPanel';
import { Vista360Panel } from '@/components/hbi/Vista360Panel';
import { CovenantsPanel } from '@/components/hbi/CovenantsPanel';
import { ComiteCreditoPanel } from '@/components/hbi/ComiteCreditoPanel';
import { CalendarioObligacionesPanel } from '@/components/hbi/CalendarioObligacionesPanel';
import { ReporteSindicatoPanel } from '@/components/hbi/ReporteSindicatoPanel';

type TabId =
  | FaseWorkflowHbi
  | 'VISTA_360'
  | 'TRAZABILIDAD'
  | 'COVENANTS'
  | 'COMITE'
  | 'OBLIGACIONES'
  | 'REPORTE_SINDICATO';

const TABS_CORE: Array<{ id: TabId; label: string }> = [
  { id: 'FASE_1_CONTRATOS', label: '1 · Contratos' },
  { id: 'FASE_2_CORREOS', label: '2 · Correos' },
  { id: 'FASE_3_EXPEDIENTE', label: '3 · Expediente 360' },
  { id: 'FASE_4_SEGUIMIENTO', label: '4 · Seguimiento' },
  { id: 'TRAZABILIDAD', label: 'Trazabilidad' },
  { id: 'VISTA_360', label: 'Vista consolidada' },
];

const TABS_IB: Array<{ id: TabId; label: string }> = [
  { id: 'COVENANTS', label: 'Covenants' },
  { id: 'COMITE', label: 'Comité crédito' },
  { id: 'OBLIGACIONES', label: 'Calendario' },
  { id: 'REPORTE_SINDICATO', label: 'Reporte sindicado' },
];

type Props = {
  data: OperacionVista360;
  faseSugerida?: FaseWorkflowHbi;
};

export function OperacionWorkflowTabs({ data, faseSugerida }: Props) {
  const [tab, setTab] = useState<TabId>(faseSugerida ?? data.faseActual);

  const tabBtn = (t: { id: TabId; label: string }) => (
    <button
      key={t.id}
      type="button"
      onClick={() => setTab(t.id)}
      className={[
        'rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
        tab === t.id
          ? 'bg-white text-blue-900 shadow-sm ring-1 ring-blue-200'
          : 'text-slate-600 hover:text-slate-900',
      ].join(' ')}
    >
      {t.label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {TABS_CORE.map(tabBtn)}
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl border border-indigo-100 bg-indigo-50/50 p-1">
          <span className="self-center px-2 text-xs font-semibold uppercase tracking-wide text-indigo-700">
            IB+
          </span>
          {TABS_IB.map(tabBtn)}
        </div>
      </div>

      {tab === 'FASE_1_CONTRATOS' ? <Fase1DocumentosPanel operacionId={data.id} /> : null}
      {tab === 'FASE_2_CORREOS' ? (
        <CorreosBandejaCompleta operacionId={data.id} codigoOperacion={data.codigoOperacion} />
      ) : null}
      {tab === 'TRAZABILIDAD' ? <TrazabilidadTimeline operacionId={data.id} /> : null}
      {tab === 'FASE_3_EXPEDIENTE' || tab === 'VISTA_360' ? <Vista360Panel data={data} /> : null}
      {tab === 'FASE_4_SEGUIMIENTO' ? (
        <Fase4ActividadesPanel operacionId={data.id} serviciosActivos={data.serviciosActivos} />
      ) : null}
      {tab === 'COVENANTS' ? <CovenantsPanel operacionId={data.id} /> : null}
      {tab === 'COMITE' ? <ComiteCreditoPanel operacionId={data.id} /> : null}
      {tab === 'OBLIGACIONES' ? <CalendarioObligacionesPanel operacionId={data.id} /> : null}
      {tab === 'REPORTE_SINDICATO' ? (
        <ReporteSindicatoPanel operacionId={data.id} codigoOperacion={data.codigoOperacion} />
      ) : null}
    </div>
  );
}
