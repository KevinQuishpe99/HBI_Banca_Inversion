'use client';

import { useAuth } from '@/hooks/useAuth';
import { signOut } from 'next-auth/react';
import { KeyRound, LogOut, User } from 'lucide-react';
import { ChangePasswordModal } from '@/components/shared/ChangePasswordModal';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { esModoDemo } from '@/lib/demo/app-mode';
import { findDemoUserByEmail } from '@/lib/auth/demo-users';
import { roleLabels as baseRoleLabels } from '@/components/admin/user-management/labels';

export function UserMenu() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  /** Clave distinta a `['meta-areas']` (lista en workflows): aquí solo mapa id→etiqueta para no pisar la caché. */
  const { data: areaLabelByCode = {}, isPending: metaAreasPending } = useQuery({
    queryKey: ['meta-areas', 'labelMap'],
    queryFn: async () => {
      const res = await fetch('/api/meta/areas');
      if (!res.ok) return {};
      const json = await res.json();
      return (Array.isArray(json?.data) ? json.data : []).reduce((acc: Record<string, string>, it: unknown) => {
        const o = it as Record<string, unknown>;
        if (o?.area != null && o?.label != null) acc[String(o.area)] = String(o.label);
        return acc;
      }, {});
    },
    staleTime: 60_000,
    enabled: !!user && !esModoDemo(),
  });

  const roleText = useMemo(() => {
    if (!user) return '';
    if (esModoDemo()) {
      const demo = findDemoUserByEmail(user.email ?? '');
      if (demo?.accesoDemoCompleto) {
        return `${demo.areaName ?? 'HBI'} · Acceso completo demo`;
      }
      if (demo?.descripcion) return demo.descripcion;
    }
    if (user.role === 'AREA_USER') {
      const areaLabel =
        user.areaId != null
          ? user.areaName ||
            areaLabelByCode[String(user.areaId)] ||
            (metaAreasPending ? '' : String(user.areaId))
          : user.areaName || '';
      return areaLabel ? `${baseRoleLabels.AREA_USER} (${areaLabel})` : baseRoleLabels.AREA_USER;
    }
    return baseRoleLabels[user.role] ?? user.role;
  }, [user, areaLabelByCode, metaAreasPending]);

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' });
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
      >
        <User className="w-4 h-4" />
        <div className="text-left hidden sm:block">
          <div className="font-medium">{user.name}</div>
          <div className="text-xs text-gray-500">{roleText}</div>
        </div>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-52 bg-white rounded-md shadow-lg py-1 z-20 border border-gray-200">
            <div className="px-4 py-2 border-b border-gray-100">
              <div className="text-sm font-medium text-gray-900">{user.name}</div>
              <div className="text-xs text-gray-500">{user.email}</div>
              <div className="text-xs text-gray-500 mt-1">{roleText}</div>
            </div>
            {!esModoDemo() ? (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setPasswordModalOpen(true);
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <KeyRound className="w-4 h-4" />
                Cambiar contraseña
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </button>
          </div>
        </>
      )}
      <ChangePasswordModal open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} />
    </div>
  );
}
