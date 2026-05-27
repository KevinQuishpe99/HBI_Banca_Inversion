'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useUnreadNotifications, useMarkAsRead } from '@/hooks/useNotifications';
import { getNotificationEmoji, formatNotificationRelativeTime } from '@/lib/notifications-ui';
import { rutaNotificacion } from '@/lib/notifications-navigation';
import type { Notification } from '@/types/notification.types';

const MAX_VISIBLE = 3;

/**
 * Avisos flotantes (opcional). No se monta en el layout por defecto: duplicaba la campana del header
 * y otro contador con distinto color. Usar solo `NotificationBell` en `DashboardHeader`.
 */
export function FloatingUnreadNotifications() {
  const router = useRouter();
  const { data: unread = [] } = useUnreadNotifications();
  const markAsRead = useMarkAsRead();

  const items = useMemo(() => {
    return [...unread]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, MAX_VISIBLE);
  }, [unread]);

  const restCount = Math.max(0, unread.length - MAX_VISIBLE);

  const dismiss = async (e: React.MouseEvent, n: Notification) => {
    e.preventDefault();
    e.stopPropagation();
    if (!n.isRead) {
      try {
        await markAsRead.mutateAsync(n.id);
      } catch {
        /* silencioso */
      }
    }
  };

  const goToCase = async (e: React.MouseEvent, n: Notification) => {
    e.preventDefault();
    if (!n.isRead) {
      try {
        await markAsRead.mutateAsync(n.id);
      } catch {
        /* seguimos */
      }
    }
    router.push(rutaNotificacion(n.tramiteId));
  };

  if (items.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed left-3 right-3 top-[4.5rem] z-[42] sm:left-auto sm:right-5 sm:w-[min(22rem,calc(100vw-2rem))] lg:right-8"
      aria-live="polite"
    >
      <div className="pointer-events-auto flex flex-col gap-2">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
          <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden />
          Sin leer
          {unread.length > 0 ? (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
              {unread.length}
            </span>
          ) : null}
        </p>

        {items.map((n) => (
          <div
            key={n.id}
            className="overflow-hidden rounded-xl border border-blue-100 bg-white/95 shadow-lg shadow-slate-400/15 backdrop-blur-sm ring-1 ring-slate-200/80"
          >
            <div className="flex gap-2 border-b border-slate-100 bg-gradient-to-r from-blue-50/90 to-indigo-50/50 px-3 py-2">
              <span className="text-lg leading-none" aria-hidden>
                {getNotificationEmoji(n.type)}
              </span>
              <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-900 line-clamp-2">
                {n.title}
              </p>
              <button
                type="button"
                onClick={(e) => dismiss(e, n)}
                className="shrink-0 rounded-md p-1 text-slate-500 transition-colors hover:bg-white/80 hover:text-slate-800"
                title="Marcar como leída"
                aria-label="Cerrar y marcar como leída"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-3 py-2">
              <p className="text-xs leading-relaxed text-slate-600 line-clamp-3">{n.message}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                <span className="font-medium text-slate-700">{n.caseNumber}</span>
                <span>•</span>
                <span>{formatNotificationRelativeTime(new Date(n.createdAt))}</span>
              </div>
              <button
                type="button"
                onClick={(e) => goToCase(e, n)}
                className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700"
              >
                Ver trámite
              </button>
            </div>
          </div>
        ))}

        {restCount > 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/90 px-3 py-2 text-center text-[11px] text-slate-600">
            +{restCount} más en la campana de notificaciones
          </p>
        ) : null}
      </div>
    </div>
  );
}
