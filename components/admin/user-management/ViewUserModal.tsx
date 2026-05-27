'use client';

import { X, Mail, Calendar, Clock, Briefcase, UserCheck, UserX, Edit } from 'lucide-react';
import { ModalFrame } from '@/components/ui/ModalFrame';
import { roleLabels } from './labels';
import type { AdminUserRow } from './types';
import { useAreaLabelMap } from './useAreaLabelMap';
import { resolveAreaDisplayName } from './area-display';

type Props = {
  user: AdminUserRow;
  onClose: () => void;
  onEdit: () => void;
};

function formatDate(dateString?: string) {
  if (!dateString) return 'Nunca';
  return new Date(dateString).toLocaleString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ViewUserModal({ user, onClose, onEdit }: Props) {
  const { data: areaLabelMap = {}, isFetched: areaMapFetched } = useAreaLabelMap();

  const areaResolved = resolveAreaDisplayName(user.area, areaLabelMap, areaMapFetched);
  const showAreaRow = Boolean(user.area);

  return (
    <ModalFrame className="max-w-2xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900 sm:text-2xl">Detalles del Usuario</h3>
          <p className="mt-1 text-sm text-gray-500">Información completa del usuario seleccionado</p>
        </div>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="space-y-6">
        <section className="rounded-lg bg-gray-50 p-4">
          <h4 className="mb-3 text-sm font-semibold uppercase text-gray-700">Información Personal</h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-xs text-gray-500">Nombre Completo</span>
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
            </div>
            <div>
              <span className="mb-1 block text-xs text-gray-500">Correo electrónico</span>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <p className="text-sm font-medium text-gray-900">{user.email}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg bg-gray-50 p-4">
          <h4 className="mb-3 text-sm font-semibold uppercase text-gray-700">Rol y Área</h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-xs text-gray-500">Rol del Sistema</span>
              <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                {roleLabels[user.role]}
              </span>
            </div>
            {showAreaRow ? (
              <div>
                <span className="mb-1 block text-xs text-gray-500">Área Asignada</span>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-purple-600" />
                  <span className="inline-flex min-h-[1.5rem] items-center rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800">
                    {areaResolved.kind === 'loading' ? (
                      <span className="text-purple-600/80" aria-label="Cargando">
                        …
                      </span>
                    ) : areaResolved.kind === 'label' || areaResolved.kind === 'fallback' ? (
                      areaResolved.text
                    ) : null}
                  </span>
                </div>
              </div>
            ) : null}
            <div>
              <span className="mb-1 block text-xs text-gray-500">Estado</span>
              {user.isActive ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                  <UserCheck className="h-4 w-4" />
                  Activo
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">
                  <UserX className="h-4 w-4" />
                  Inactivo
                </span>
              )}
            </div>
            <div>
              <span className="mb-1 block text-xs text-gray-500">Permiso de firma</span>
              {user.canSign ? (
                <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                  Habilitado
                </span>
              ) : user.puedeFirmar ? (
                <div className="space-y-1">
                  <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900">
                    Pendiente de área
                  </span>
                  <p className="text-xs text-gray-600">
                    El usuario tiene «puede firmar» en base de datos, pero el área no está marcada como firma
                    (Legal) o cierre (Director). Revise Administración → Configuración de áreas.
                  </p>
                </div>
              ) : (
                <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                  No habilitado
                </span>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-lg bg-gray-50 p-4">
          <h4 className="mb-3 text-sm font-semibold uppercase text-gray-700">Información de Actividad</h4>
          <div className="grid gap-4">
            <div>
              <span className="mb-1 block text-xs text-gray-500">Fecha de Creación</span>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <p className="text-sm font-medium text-gray-900">{formatDate(user.createdAt)}</p>
              </div>
            </div>
            <div>
              <span className="mb-1 block text-xs text-gray-500">Último Inicio de Sesión</span>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <p className="text-sm font-medium text-gray-900">{formatDate(user.lastLogin)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg bg-gray-50 p-4">
          <h4 className="mb-3 text-sm font-semibold uppercase text-gray-700">Información Técnica</h4>
          <span className="mb-1 block text-xs text-gray-500">ID del Usuario</span>
          <p className="rounded border border-gray-200 bg-white px-2 py-1 font-mono text-xs text-gray-600">{user.id}</p>
        </section>
      </div>

      <div className="mt-6 flex flex-col justify-end gap-3 border-t border-gray-200 pt-6 sm:flex-row">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-md px-4 py-2 text-gray-700 hover:bg-gray-100 sm:w-auto"
        >
          Cerrar
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 sm:w-auto"
        >
          <Edit className="h-4 w-4" />
          Editar Usuario
        </button>
      </div>
    </ModalFrame>
  );
}
