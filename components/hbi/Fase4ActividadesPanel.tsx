'use client';

import type { TipoServicioHbi } from '@/types/hbi/operacion.types';
import { TIPOS_SERVICIO_LABEL } from '@/types/hbi/operacion.types';
import { useHbiActividades, useActualizarActividadHbi } from '@/hooks/useHbiOperaciones';
import { Loader2 } from 'lucide-react';

const ESTADOS = ['PENDIENTE', 'EN_PROGRESO', 'COMPLETADA', 'BLOQUEADA'] as const;

type Props = {
  operacionId: string;
  serviciosActivos: TipoServicioHbi[];
};

export function Fase4ActividadesPanel({ operacionId, serviciosActivos }: Props) {
  const { data: actividades, isLoading } = useHbiActividades(operacionId);
  const actualizar = useActualizarActividadHbi(operacionId);

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="font-semibold text-slate-900">Fase 4 — Motor operativo por servicio</h3>
        <p className="mt-1 text-sm text-slate-600">
          Seguimiento recurrente segregado por Anexos 1, 2 y 3. Trazabilidad por tipo de servicio.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className="space-y-6">
          {serviciosActivos.map((servicio) => {
            const delServicio = actividades?.filter((a) => a.tipoServicio === servicio) ?? [];
            return (
              <div key={servicio}>
                <h4 className="mb-2 text-sm font-semibold text-slate-800">
                  {TIPOS_SERVICIO_LABEL[servicio]}
                </h4>
                {delServicio.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Sin actividades — se generan al avanzar a Fase 4.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {delServicio.map((a) => (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">{a.titulo}</p>
                          {a.descripcion ? (
                            <p className="text-xs text-slate-500">{a.descripcion}</p>
                          ) : null}
                        </div>
                        <select
                          value={a.estado}
                          disabled={actualizar.isPending}
                          onChange={(e) =>
                            actualizar.mutate({
                              actividadId: a.id,
                              estado: e.target.value,
                            })
                          }
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                        >
                          {ESTADOS.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
