'use client';

import { useSession } from 'next-auth/react';
import { Edit, Trash2, UserCheck, UserX } from 'lucide-react';
import { roleLabels } from './labels';
import type { AdminUserRow } from './types';
import { useAreaLabelMap } from './useAreaLabelMap';
import { resolveAreaDisplayName } from './area-display';
import { Swal, escapeSwalHtml } from '@/lib/ui/swal';
import { adminTableHead, adminTableHeadRight } from '@/lib/ui/admin-ui';

type Props = {
  users: AdminUserRow[] | undefined;
  onRowClick: (user: AdminUserRow) => void;
  onEdit: (user: AdminUserRow) => void;
  onDeactivate: (id: string) => void;
};

export function UserTable({ users, onRowClick, onEdit, onDeactivate }: Props) {
  const { data: session } = useSession();
  const myId = session?.user?.id;

  const { data: areaLabelMap = {}, isFetched: areaMapFetched } = useAreaLabelMap();

  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="min-w-full divide-y divide-admin-border">
        <thead>
          <tr>
            <th className={adminTableHead}>Usuario</th>
            <th className={adminTableHead}>Correo</th>
            <th className={adminTableHead}>Rol</th>
            <th className={adminTableHead}>Área</th>
            <th className={adminTableHead}>Estado</th>
            <th className={adminTableHead}>Firma</th>
            <th className={adminTableHeadRight}>Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-admin-border bg-admin-surface">
          {users?.map((user) => (
            <tr
              key={user.id}
              onClick={() => onRowClick(user)}
              className="cursor-pointer transition-colors hover:bg-admin-muted"
            >
              <td className="whitespace-nowrap px-4 py-3">
                <div className="text-sm font-medium text-admin-text">{user.name}</div>
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <div className="text-sm text-admin-text-secondary">{user.email}</div>
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-900">
                  {roleLabels[user.role]}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                {user.area ? (
                  (() => {
                    const r = resolveAreaDisplayName(user.area, areaLabelMap, areaMapFetched);
                    if (r.kind === 'loading') {
                      return (
                        <span
                          className="inline-block min-w-[4.5rem] text-center text-admin-placeholder"
                          aria-label="Cargando nombre del área"
                        >
                          …
                        </span>
                      );
                    }
                    const text = r.kind === 'label' || r.kind === 'fallback' ? r.text : '';
                    return (
                      <span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-medium text-violet-900">
                        {text}
                      </span>
                    );
                  })()
                ) : (
                  <span className="text-xs text-admin-placeholder">—</span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                {user.isActive ? (
                  <span className="flex items-center gap-1 text-sm font-medium text-green-800">
                    <UserCheck className="h-4 w-4 shrink-0" />
                    Activo
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm font-medium text-red-800">
                    <UserX className="h-4 w-4 shrink-0" />
                    Inactivo
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                {user.canSign ? (
                  <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-900">
                    Habilitada
                  </span>
                ) : user.puedeFirmar ? (
                  <span
                    className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900"
                    title="Tiene permiso en usuario, pero el área no está configurada para firma (Legal o Director)"
                  >
                    Revisar área
                  </span>
                ) : (
                  <span className="rounded-full bg-admin-muted px-2 py-1 text-xs font-medium text-admin-text-secondary">
                    No
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(user);
                  }}
                  className="mr-3 text-admin-primary hover:text-admin-primary-hover"
                  title="Editar usuario"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={user.id === myId}
                  onClick={(e) => {
                    e.stopPropagation();
                    void (async () => {
                      const r = await Swal.fire({
                        title: '¿Eliminar usuario?',
                        html: `Se eliminará a <strong>${escapeSwalHtml(user.name)}</strong> del sistema. Si tiene trámites u otros datos vinculados, solo se desactivará el acceso.`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Eliminar',
                        cancelButtonText: 'Cancelar',
                        confirmButtonColor: '#dc2626',
                        cancelButtonColor: '#6b7280',
                        reverseButtons: true,
                      });
                      if (r.isConfirmed) onDeactivate(user.id);
                    })();
                  }}
                  className="text-red-700 hover:text-red-900 disabled:cursor-not-allowed disabled:opacity-40"
                  title={user.id === myId ? 'No puede eliminar su propio usuario' : 'Eliminar usuario'}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
