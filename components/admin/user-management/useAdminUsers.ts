'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminUserRow } from './types';

export function useAdminUsers() {
  const queryClient = useQueryClient();

  const query = useQuery<AdminUserRow[]>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const response = await fetch('/api/admin/users', { credentials: 'include' });
      if (!response.ok) throw new Error('Error al cargar usuarios');
      const data = await response.json();
      return data.data;
    },
  });

  const createMutation = useMutation({
    meta: { lockMessage: 'Creando usuario…' },
    mutationFn: async (userData: Record<string, unknown>) => {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error((errorData.error as string) || 'Error al crear usuario');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const updateMutation = useMutation({
    meta: { lockMessage: 'Guardando usuario…' },
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error((errBody as { error?: string }).error || 'Error al actualizar usuario');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const deleteMutation = useMutation({
    meta: { lockMessage: 'Eliminando usuario…' },
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/users/${id}`, { method: 'DELETE', credentials: 'include' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((body as { error?: string }).error || 'Error al eliminar usuario');
      }
      const data = (body as { data?: { message?: string; mode?: string } }).data;
      return { message: data?.message ?? 'Operación completada', mode: data?.mode };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  return { ...query, createMutation, updateMutation, deleteMutation };
}
