'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Loader2, Search } from 'lucide-react';
import { Toast } from '@/components/shared/Toast';
import { useToast } from '@/hooks/useToast';
import {
  adminBtnPrimary,
  adminCard,
  adminInput,
  adminLabel,
  adminToolbar,
} from '@/lib/ui/admin-ui';
import { useAdminUsers } from './useAdminUsers';
import { UserTable } from './UserTable';
import { CreateUserModal } from './CreateUserModal';
import { EditUserModal } from './EditUserModal';
import { ViewUserModal } from './ViewUserModal';
import type { AdminUserRow } from './types';

type RoleFilter = '' | 'ADMIN' | 'AREA_USER' | 'USER';
type ActiveFilter = 'all' | 'active' | 'inactive';

export function UserManagement() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserRow | null>(null);
  const [viewingUser, setViewingUser] = useState<AdminUserRow | null>(null);
  const { toasts, hideToast, success, error } = useToast();

  const [searchDraft, setSearchDraft] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchDraft.trim()), 300);
    return () => clearTimeout(t);
  }, [searchDraft]);

  const { data: users, isLoading, createMutation, updateMutation, deleteMutation } = useAdminUsers();

  const filteredUsers = useMemo(() => {
    if (!users?.length) return [];
    const q = debouncedSearch.toLowerCase();
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (activeFilter === 'active' && !u.isActive) return false;
      if (activeFilter === 'inactive' && u.isActive) return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        (u.firstName ?? '').toLowerCase().includes(q) ||
        (u.lastName ?? '').toLowerCase().includes(q)
      );
    });
  }, [users, debouncedSearch, roleFilter, activeFilter]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-admin-primary" />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className={`${adminCard} min-w-0`}>
        <div className={adminToolbar}>
          <h3 className="text-sm font-semibold text-admin-text-strong">Usuarios del sistema</h3>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className={`${adminBtnPrimary} px-4 py-2`}
          >
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </button>
        </div>

        <p className="border-b border-admin-border px-4 py-3 text-xs text-admin-text-secondary">
          La columna <span className="font-medium text-admin-text">Firma</span> resume si el usuario puede firmar en la
          práctica. La opción «Puede firmar documentos» al editar solo aplica si en{' '}
          <span className="font-medium text-admin-text">Administración → Configuración de áreas</span> esa fila tiene{' '}
          <span className="font-medium text-admin-text">Firma doc.</span> (Legal) o <span className="font-medium text-admin-text">Cierra trám.</span>{' '}
          (Director) y usted pulsa <span className="font-medium text-admin-text">Guardar</span> allí.
        </p>

        <div className="flex flex-col gap-3 border-b border-admin-border p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 flex-1 sm:min-w-[220px]">
            <label htmlFor="admin-users-search" className={adminLabel}>
              Buscar
            </label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-placeholder" />
              <input
                id="admin-users-search"
                type="search"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Nombre, apellido o correo"
                className={`${adminInput} pl-9`}
                autoComplete="off"
              />
            </div>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[160px]">
            <label htmlFor="admin-users-role" className={adminLabel}>
              Rol
            </label>
            <select
              id="admin-users-role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
              className={`${adminInput} mt-1 py-2`}
            >
              <option value="">Todos los roles</option>
              <option value="USER">Usuario</option>
              <option value="AREA_USER">Usuario de área</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[160px]">
            <label htmlFor="admin-users-active" className={adminLabel}>
              Estado
            </label>
            <select
              id="admin-users-active"
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
              className={`${adminInput} mt-1 py-2`}
            >
              <option value="all">Todos</option>
              <option value="active">Solo activos</option>
              <option value="inactive">Solo inactivos</option>
            </select>
          </div>
        </div>

        <p className="border-b border-admin-border px-4 py-2 text-xs text-admin-text-secondary">
          Mostrando {filteredUsers.length} de {users?.length ?? 0} usuarios
          {debouncedSearch || roleFilter || activeFilter !== 'all' ? ' (filtros activos)' : ''}
        </p>

        {filteredUsers.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-admin-text-secondary">
            {users?.length === 0
              ? 'No hay usuarios registrados.'
              : 'Ningún usuario coincide con los filtros. Ajuste la búsqueda o los criterios.'}
          </p>
        ) : (
          <UserTable
            users={filteredUsers}
            onRowClick={setViewingUser}
            onEdit={setEditingUser}
            onDeactivate={(id) =>
              deleteMutation.mutate(id, {
                onSuccess: (res) => success(res?.message ?? 'Usuario eliminado'),
                onError: (err: Error) => error(err.message),
              })
            }
          />
        )}
      </div>

      {showCreateModal ? (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={(data) =>
            createMutation.mutate(data, {
              onSuccess: () => {
                setShowCreateModal(false);
                success('Usuario creado exitosamente');
              },
              onError: (err: Error) => error(err.message),
            })
          }
          isLoading={createMutation.isPending}
        />
      ) : null}

      {editingUser ? (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSubmit={(data) =>
            updateMutation.mutate(
              { id: editingUser.id, data },
              {
                onSuccess: () => {
                  setEditingUser(null);
                  success('Usuario actualizado exitosamente');
                },
                onError: (err: Error) => error(err.message),
              }
            )
          }
          isLoading={updateMutation.isPending}
        />
      ) : null}

      {viewingUser ? (
        <ViewUserModal
          user={viewingUser}
          onClose={() => setViewingUser(null)}
          onEdit={() => {
            setEditingUser(viewingUser);
            setViewingUser(null);
          }}
        />
      ) : null}

      {toasts.map((toast, i) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          zIndex={200 + i}
          onClose={() => hideToast(toast.id)}
        />
      ))}
    </div>
  );
}
