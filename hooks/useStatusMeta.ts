'use client';

import { useQuery } from '@tanstack/react-query';
import type { StatusConfigRow } from '@/lib/status-config';

const stale = 5 * 60 * 1000;

export function useCaseStatusMeta() {
  return useQuery({
    queryKey: ['meta', 'case-statuses'],
    queryFn: async (): Promise<StatusConfigRow[]> => {
      const res = await fetch('/api/meta/case-statuses');
      if (!res.ok) throw new Error('Error al cargar estados de trámite');
      const json = await res.json();
      return Array.isArray(json?.data) ? json.data : [];
    },
    staleTime: stale,
  });
}

/** Estados de trámite desde BD; para kind `workflow` no hay catálogo (solo fallback en StatusBadge). */
export function useStatusMetaForBadge(kind: 'case' | 'workflow') {
  return useQuery({
    queryKey: ['meta', 'case-statuses'],
    queryFn: async (): Promise<StatusConfigRow[]> => {
      const res = await fetch('/api/meta/case-statuses');
      if (!res.ok) throw new Error('Error al cargar estados de trámite');
      const json = await res.json();
      return Array.isArray(json?.data) ? json.data : [];
    },
    staleTime: stale,
    enabled: kind === 'case',
  });
}
