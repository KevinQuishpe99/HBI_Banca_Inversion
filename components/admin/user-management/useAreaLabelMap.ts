'use client';

import { useQuery } from '@tanstack/react-query';

/** Mapa id de área (string) → nombre visible; alineado con GET /api/admin/areas. */
export function useAreaLabelMap() {
  return useQuery<Record<string, string>>({
    queryKey: ['area-labels'],
    queryFn: async () => {
      const res = await fetch('/api/admin/areas', { credentials: 'include' });
      if (!res.ok) return {};
      const json = (await res.json()) as { data?: { area: string; label?: string }[] };
      const map: Record<string, string> = {};
      for (const row of json.data ?? []) {
        if (row.area) map[row.area] = row.label || row.area;
      }
      return map;
    },
    staleTime: 60_000,
  });
}
