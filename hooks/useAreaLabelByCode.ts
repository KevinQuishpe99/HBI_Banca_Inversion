'use client';

import { useEffect, useState } from 'react';

type MetaArea = {
  area?: string;
  label?: string;
  supervisorName?: string | null;
};

export type AreaMetaMaps = {
  areaLabelByCode: Record<string, string>;
  /** Nombre del supervisor titular por código de área (misma fuente que meta). */
  areaSupervisorByCode: Record<string, string | null>;
};

/**
 * Etiquetas y supervisor titular por código de área (GET /api/meta/areas).
 */
export function useAreaMeta(): AreaMetaMaps {
  const [state, setState] = useState<AreaMetaMaps>({
    areaLabelByCode: {},
    areaSupervisorByCode: {},
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/meta/areas');
        const json = await res.json();
        if (cancelled) return;
        const list = (Array.isArray(json?.data) ? json.data : []) as MetaArea[];
        const areaLabelByCode: Record<string, string> = {};
        const areaSupervisorByCode: Record<string, string | null> = {};
        for (const it of list) {
          if (!it?.area) continue;
          if (it.label) areaLabelByCode[it.area] = it.label;
          const sn = it.supervisorName != null ? String(it.supervisorName).trim() : '';
          areaSupervisorByCode[it.area] = sn || null;
        }
        setState({ areaLabelByCode, areaSupervisorByCode });
      } catch {
        // ignorar
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/**
 * Solo etiquetas (usa el mismo fetch que `useAreaMeta`).
 */
export function useAreaLabelByCode(): Record<string, string> {
  const { areaLabelByCode } = useAreaMeta();
  return areaLabelByCode;
}
