'use client';

import { useEffect, useMemo } from 'react';
import { formInputPurple, formLabel } from '@/components/ui/form-classes';
import { useAdminAreasQuery } from '@/hooks/useAdminAreasQuery';

type Props = {
  area: string;
  onAreaChange: (v: string, allowsSigning: boolean) => void;
  required?: boolean;
  showHint?: boolean;
};

type AreaOption = { area: string; label: string; allowsSigning?: boolean };

/** Misma query que Configuración de áreas → se actualiza al crear/editar áreas sin recargar. */
export function AreaRoleFields({ area, onAreaChange, required, showHint }: Props) {
  const { data: areaRows = [], isError, isLoading } = useAdminAreasQuery();

  const options = useMemo((): AreaOption[] => {
    return areaRows
      .filter((r) => r.isActive)
      .map((r) => ({
        area: r.area,
        label: r.label?.trim() || r.area,
        /** Firma Legal (documentos) o Director (cierra trámite); coherente con validación de usuarios. */
        allowsSigning: r.allowsSigning === true || r.canCompleteCase === true,
      }));
  }, [areaRows]);

  useEffect(() => {
    if (!area || options.length === 0) return;
    const match = options.find((o) => o.area === area);
    if (match) onAreaChange(area, match.allowsSigning ?? false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al sincronizar allowsSigning cuando cambian opciones
  }, [area, options]);

  return (
    <div>
      <label className={formLabel}>
        Área <span className="text-red-500">*</span>
      </label>
      <select
        value={area}
        onChange={(e) => {
          const sel = options.find((o) => o.area === e.target.value);
          onAreaChange(e.target.value, sel?.allowsSigning ?? false);
        }}
        className={formInputPurple}
        required={required}
      >
        <option value="">Seleccionar área...</option>
        {options.map((o) => (
          <option key={o.area} value={o.area}>
            {o.label}
          </option>
        ))}
      </select>
      {isError ? (
        <p className="mt-1 text-xs text-amber-700">No se pudieron cargar las áreas. Recargue la página o revise la conexión.</p>
      ) : null}
      {isLoading && options.length === 0 ? (
        <p className="mt-1 text-xs text-gray-500">Cargando áreas…</p>
      ) : null}
      {showHint ? (
        <p className="mt-1 text-xs text-gray-500">
          El supervisor de área revisa y aprueba los trámites en la etapa correspondiente a esta área.
        </p>
      ) : null}
    </div>
  );
}
