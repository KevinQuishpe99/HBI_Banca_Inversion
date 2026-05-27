'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, Loader2, X } from 'lucide-react';
import { useNotifications, useUnreadCount, useMarkAsRead, useMarkAllAsRead } from '@/hooks/useNotifications';
import { getNotificationEmoji, formatNotificationRelativeTime } from '@/lib/notifications-ui';
import { rutaNotificacion } from '@/lib/notifications-navigation';
import { useRouter } from 'next/navigation';
import { Notification } from '@/types/notification.types';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { data: unreadCount = 0 } = useUnreadCount();
  const { data: notifications = [], isLoading } = useNotifications(false, isOpen);
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markAsRead.mutateAsync(notification.id);
    }
    setIsOpen(false);
    router.push(rutaNotificacion(notification.tramiteId));
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead.mutateAsync();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón de notificaciones */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
        title="Notificaciones"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown de notificaciones */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[600px] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Notificaciones</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  title="Marcar todas como leídas"
                >
                  <CheckCheck className="w-4 h-4" />
                  Marcar todas
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Lista de notificaciones */}
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No tienes notificaciones</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                      !notification.isRead ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="text-2xl flex-shrink-0">
                        {getNotificationEmoji(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900 line-clamp-1">
                            {notification.title}
                          </p>
                          {!notification.isRead && (
                            <span className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1"></span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-gray-500">
                            {notification.caseNumber}
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500">
                            {formatNotificationRelativeTime(new Date(notification.createdAt))}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 text-center">
              <button
                onClick={() => {
                  setIsOpen(false);
                  // Aquí podrías navegar a una página de todas las notificaciones
                }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Ver todas las notificaciones
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
