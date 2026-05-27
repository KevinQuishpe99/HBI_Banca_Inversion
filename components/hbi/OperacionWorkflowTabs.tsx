'use client';

import { useState } from 'react';
import type { FaseWorkflowHbi, OperacionVista360 } from '@/types/hbi/operacion.types';
import { Fase1DocumentosPanel } from '@/components/hbi/Fase1DocumentosPanel';
import { CorreosBandejaCompleta } from '@/components/hbi/CorreosBandejaCompleta';
import { TrazabilidadTimeline } from '@/components/hbi/TrazabilidadTimeline';
import { Fase4ActividadesPanel } from '@/components/hbi/Fase4ActividadesPanel';
import { Vista360Panel } from '@/components/hbi/Vista360Panel';

const TABS: Array<{ id: FaseWorkflowHbi | 'VISTA_360' | 'TRAZABILIDAD'; label: string }> = [
  { id: 'FASE_1_CONTRATOS', label: '1 · Contratos' },
  { id: 'FASE_2_CORREOS', label: '2 · Correos' },
  { id: 'FASE_3_EXPEDIENTE', label: '3 · Expediente 360' },
  { id: 'FASE_4_SEGUIMIENTO', label: '4 · Seguimiento' },
  { id: 'TRAZABILIDAD', label: 'Trazabilidad' },
  { id: 'VISTA_360', label: 'Vista consolidada' },
];

type Props = {
  data: OperacionVista360;
  faseSugerida?: FaseWorkflowHbi;
};

export function OperacionWorkflowTabs({ data, faseSugerida }: Props) {
  const [tab, setTab] = useState<FaseWorkflowHbi | 'VISTA_360' | 'TRAZABILIDAD'>(
    faseSugerida ?? data.faseActual
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              tab === t.id
                ? 'bg-white text-blue-900 shadow-sm ring-1 ring-blue-200'
                : 'text-slate-600 hover:text-slate-900',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
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
    </div>
  );
}
