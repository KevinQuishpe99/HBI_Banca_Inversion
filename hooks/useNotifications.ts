import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Notification } from '@/types/notification.types';

export function useNotifications(unreadOnly: boolean = false, enabled: boolean = true) {
  return useQuery<Notification[]>({
    queryKey: ['notifications', unreadOnly],
    queryFn: async () => {
      const response = await fetch(`/api/notifications?unreadOnly=${unreadOnly}`);
      if (!response.ok) throw new Error('Error al cargar notificaciones');
      const data = await response.json();
      return data.data;
    },
    enabled,
    refetchInterval: enabled ? 60000 : false, // Solo cuando el panel está abierto
    refetchOnWindowFocus: false,
  });
}

/** No leídas para aviso flotante: misma query que `unreadOnly=true`, con refresco automático. */
export function useUnreadNotifications() {
  return useQuery<Notification[]>({
    queryKey: ['notifications', true],
    queryFn: async () => {
      const response = await fetch('/api/notifications?unreadOnly=true&limit=20');
      if (!response.ok) throw new Error('Error al cargar notificaciones');
      const data = await response.json();
      return data.data as Notification[];
    },
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
}

export function useUnreadCount() {
  return useQuery<number>({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/unread-count');
      if (!response.ok) throw new Error('Error al cargar contador');
      const data = await response.json();
      return data.data.count;
    },
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
      });
      if (!response.ok) throw new Error('Error al marcar notificación');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
      });
      if (!response.ok) throw new Error('Error al marcar todas las notificaciones');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });
}
