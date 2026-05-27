'use client';

import { useQuery } from '@tanstack/react-query';

/** Fila de GET /api/admin/areas (misma forma en toda la app). */
export type AdminAreaConfig = {
  id: number;
  area: string;
  label: string;
  isActive: boolean;
  isSelectable: boolean;
  isMandatory: boolean;
  sortOrder: number;
  supervisorId: string | null;
  supervisorName: string | null;
  supervisorEmail: string | null;
  allowsSigning: boolean;
  isFinalStep: boolean;
  notifyOnHighAmount: boolean;
  canCompleteCase: boolean;
  supervisorCanCreateCase: boolean;
};

export function useAdminAreasQuery() {
  return useQuery<AdminAreaConfig[]>({
    queryKey: ['admin-areas'],
    queryFn: async () => {
      const res = await fetch('/api/admin/areas', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al cargar áreas');
      const json = await res.json();
      return json.data as AdminAreaConfig[];
    },
    staleTime: 60_000,
  });
}
