'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminAreasQuery, type AdminAreaConfig } from '@/hooks/useAdminAreasQuery';
import { invalidateAreaCaches } from '@/lib/query/invalidate-area-caches';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { Toast } from '@/components/shared/Toast';
import { escapeSwalHtml, swalAlertError, swalConfirmDanger } from '@/lib/ui/swal';
import {
  adminBtnDangerOutline,
  adminBtnPrimary,
  adminCard,
  adminInput,
  adminPageDesc,
  adminPageTitle,
  adminTableHead,
  adminTableHeadRight,
  adminToolbar,
} from '@/lib/ui/admin-ui';
import { CreateAreaModal, type CreateAreaPayload } from '@/components/admin/CreateAreaModal';

type DraftFields = {
  label: string;
  isActive: boolean;
  isSelectable: boolean;
  isMandatory: boolean;
  allowsSigning: boolean;
  canCompleteCase: boolean;
};

type AdminUserLite = {
  id: string;
  email: string;
  name: string;
  role: string;
  area: string | null;
  isActive: boolean;
};

type AreaPatchPayload = {
  id: number;
  label?: string;
  isActive?: boolean;
  isSelectable?: boolean;
  isMandatory?: boolean;
  supervisorUserId?: string | null;
  allowsSigning?: boolean;
  canCompleteCase?: boolean;
};

function draftsFromRows(rows: AdminAreaConfig[]): Record<number, DraftFields> {
  return Object.fromEntries(
    rows.map((r) => [
      r.id,
      {
        label: r.label,
        isActive: r.isActive,
        isSelectable: r.isSelectable,
        isMandatory: r.isMandatory,
        allowsSigning: r.allowsSigning,
        canCompleteCase: r.canCompleteCase,
      },
    ])
  );
}

function rowDirty(row: AdminAreaConfig, d: DraftFields | undefined): boolean {
  if (!d) return false;
  return (
    d.label !== row.label ||
    d.isActive !== row.isActive ||
    d.isSelectable !== row.isSelectable ||
    d.isMandatory !== row.isMandatory ||
    d.allowsSigning !== row.allowsSigning ||
    d.canCompleteCase !== row.canCompleteCase
  );
}

function supervisorDirty(row: AdminAreaConfig, draftSupervisorId: string | null | undefined): boolean {
  const a = draftSupervisorId ?? null;
  const b = row.supervisorId ?? null;
  return a !== b;
}

export default function AdminAreasPage() {
  const queryClient = useQueryClient();
  const { toasts, hideToast, success, error } = useToast();

  const [showCreateModal, setShowCreateModal] = useState(false);

  const [drafts, setDrafts] = useState<Record<number, DraftFields>>({});
  const [supervisorDrafts, setSupervisorDrafts] = useState<Record<number, string | null>>({});

  const { data, isLoading } = useAdminAreasQuery();

  const { data: usersData } = useQuery<AdminUserLite[]>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al cargar usuarios');
      const json = await res.json();
      return json.data as AdminUserLite[];
    },
  });

  useEffect(() => {
    if (!data || data.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDrafts({});
      setSupervisorDrafts({});
      return;
    }
    setDrafts(draftsFromRows(data));
    setSupervisorDrafts(Object.fromEntries(data.map((r) => [r.id, r.supervisorId])));
  }, [data]);

  const createMutation = useMutation({
    mutationFn: async (payload: CreateAreaPayload) => {
      const res = await fetch('/api/admin/areas', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: payload.label,
          isActive: payload.isActive,
          isSelectable: payload.isSelectable,
          isMandatory: payload.isMandatory,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al crear área');
      return json.data as AdminAreaConfig;
    },
    onSuccess: async () => {
      await invalidateAreaCaches(queryClient);
      setShowCreateModal(false);
      success('Área creada');
    },
    onError: (e: unknown) => error(e instanceof Error ? e.message : 'Error'),
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: AreaPatchPayload) => {
      const res = await fetch('/api/admin/areas', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al actualizar área');
      return json.data as AdminAreaConfig;
    },
    onError: async (e: unknown) => {
      await swalAlertError('No se pudo guardar', e instanceof Error ? e.message : 'Error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/areas/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'No se pudo eliminar el área');
    },
    onSuccess: async () => {
      await invalidateAreaCaches(queryClient);
      success('Área eliminada');
    },
    onError: async (e: unknown) => {
      await swalAlertError('No se pudo eliminar', e instanceof Error ? e.message : 'Error');
    },
  });

  const requestDeleteArea = useCallback(
    async (row: AdminAreaConfig) => {
      const confirmed = await swalConfirmDanger({
        title: '¿Eliminar área?',
        html: `Se eliminará el área <strong>${escapeSwalHtml(row.label)}</strong> (id ${row.id}). Esta acción <strong>no se puede deshacer</strong>.`,
        confirmButtonText: 'Sí, eliminar',
      });
      if (!confirmed) return;
      deleteMutation.mutate(row.id);
    },
    [deleteMutation]
  );

  const updateDraft = useCallback((id: number, patch: Partial<DraftFields>) => {
    setDrafts((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      return { ...prev, [id]: { ...cur, ...patch } };
    });
  }, []);

  const updateSupervisorDraft = useCallback((id: number, supervisorUserId: string | null) => {
    setSupervisorDrafts((prev) => ({ ...prev, [id]: supervisorUserId }));
  }, []);

  const anyDirty = useMemo(() => {
    if (!data) return false;
    return data.some(
      (row) => rowDirty(row, drafts[row.id]) || supervisorDirty(row, supervisorDrafts[row.id])
    );
  }, [data, drafts, supervisorDrafts]);

  const saveAllTable = useCallback(async () => {
    if (!data) return;
    const dirtyRows = data.filter(
      (row) => rowDirty(row, drafts[row.id]) || supervisorDirty(row, supervisorDrafts[row.id])
    );
    if (dirtyRows.length === 0) return;
    try {
      for (const row of dirtyRows) {
        const d = drafts[row.id];
        if (!d) continue;
        const textDirty = rowDirty(row, d);
        const supDirty = supervisorDirty(row, supervisorDrafts[row.id]);
        const payload: AreaPatchPayload = { id: row.id };
        if (textDirty) {
          payload.label = d.label;
          payload.isActive = d.isActive;
          payload.isSelectable = d.isSelectable;
          payload.isMandatory = d.isMandatory;
          payload.allowsSigning = d.allowsSigning;
          payload.canCompleteCase = d.canCompleteCase;
        }
        if (supDirty) {
          payload.supervisorUserId = supervisorDrafts[row.id] ?? null;
        }
        await updateMutation.mutateAsync(payload);
      }
      await invalidateAreaCaches(queryClient);
      success(
        dirtyRows.length === 1 ? 'Cambios guardados' : `Guardadas ${dirtyRows.length} áreas`
      );
    } catch {
      /* errores vía onError de la mutación */
    }
  }, [data, drafts, supervisorDrafts, updateMutation, queryClient, success]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-admin-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className={adminPageTitle}>Configuración de áreas</h1>
        <p className={adminPageDesc}>
          Edite nombre, <span className="font-medium text-admin-text">Activa</span>,{' '}
          <span className="font-medium text-admin-text">Seleccionable</span>,{' '}
          <span className="font-medium text-admin-text">Obligatoria</span>,{' '}
          <span className="font-medium text-admin-text">Firma doc.</span> (área que firma documentos en el flujo) y{' '}
          <span className="font-medium text-admin-text">Cierra trám.</span> (área que completa el trámite). Puede
          marcar <span className="font-medium text-admin-text">ambas</span> en la misma fila si quien firma también
          cierra el trámite; solo un área debe tener <span className="font-medium text-admin-text">Firma doc.</span> y
          solo un área <span className="font-medium text-admin-text">Cierra trám.</span> (al guardar se desmarcan en
          las demás filas). Pulse <span className="font-medium text-admin-text">Guardar</span> para persistir. El{' '}
          <span className="font-medium text-admin-text">supervisor titular</span> debe ser un usuario de área activo de
          esa área (defínalo en <span className="font-medium text-admin-text">Gestión de usuarios</span>); si lo
          desactiva, el sistema quita la asignación. El permiso «Puede firmar» en usuarios no sustituye marcar{' '}
          <span className="font-medium text-admin-text">Firma doc.</span> aquí cuando aplique firma Legal en trámites.
        </p>
      </div>

      <div className={adminCard}>
        <div className={adminToolbar}>
          <h2 className="text-sm font-semibold text-admin-text-strong">Áreas del sistema</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void saveAllTable()}
              disabled={updateMutation.isPending || deleteMutation.isPending || !anyDirty}
              className={`${adminBtnPrimary} px-3 py-2`}
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Save className="h-4 w-4 shrink-0" aria-hidden />
              )}
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              disabled={createMutation.isPending}
              className={`${adminBtnPrimary} px-4 py-2`}
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              Nueva área
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-admin-border text-sm text-admin-text">
            <thead>
              <tr>
                <th className={adminTableHead}>Nombre del área</th>
                <th className={adminTableHead}>Activa</th>
                <th
                  className={adminTableHead}
                  title="Visible en registro público / autoregistro"
                >
                  Seleccionable
                </th>
                <th className={adminTableHead}>Obligatoria</th>
                <th className={adminTableHead} title="Área que firma documentos marcados para firma Legal">
                  Firma doc.
                </th>
                <th className={adminTableHead} title="Área que completa el trámite (Director General); solo una">
                  Cierra trám.
                </th>
                <th className={adminTableHead} title="Usuario AREA_USER activo de esta área">
                  Supervisor titular
                </th>
                <th className={adminTableHeadRight}>Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border bg-admin-surface">
              {(data || []).map((row) => {
                const d = drafts[row.id];
                return (
                  <AreaTableRow
                    key={row.id}
                    row={row}
                    draft={d}
                    users={usersData ?? []}
                    supervisorUserId={supervisorDrafts[row.id] ?? null}
                    onSupervisorChange={updateSupervisorDraft}
                    disabled={updateMutation.isPending}
                    deleteDisabled={deleteMutation.isPending}
                    onChange={updateDraft}
                    onRequestDelete={requestDeleteArea}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <CreateAreaModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={(payload) => createMutation.mutate(payload)}
        isPending={createMutation.isPending}
      />

      {toasts.map((t, i) => (
        <Toast key={t.id} message={t.message} type={t.type} zIndex={200 + i} onClose={() => hideToast(t.id)} />
      ))}
    </div>
  );
}

function AreaTableRow({
  row,
  draft,
  users,
  supervisorUserId,
  onSupervisorChange,
  disabled,
  deleteDisabled,
  onChange,
  onRequestDelete,
}: {
  row: AdminAreaConfig;
  draft: DraftFields | undefined;
  users: AdminUserLite[];
  supervisorUserId: string | null;
  onSupervisorChange: (id: number, supervisorUserId: string | null) => void;
  disabled: boolean;
  deleteDisabled: boolean;
  onChange: (id: number, patch: Partial<DraftFields>) => void;
  onRequestDelete: (row: AdminAreaConfig) => void | Promise<void>;
}) {
  if (!draft) {
    return (
      <tr>
        <td colSpan={8} className="px-4 py-3 text-admin-placeholder">
          …
        </td>
      </tr>
    );
  }

  const activeAreaSupervisors = users.filter(
    (u) => u.area === String(row.id) && u.role === 'AREA_USER' && u.isActive
  );
  const titularUser = supervisorUserId ? users.find((u) => u.id === supervisorUserId) : null;
  const showInactiveTitularOption = !!(titularUser && !titularUser.isActive);

  return (
    <tr className="text-admin-text transition-colors hover:bg-admin-muted">
      <td className="px-4 py-3">
        <input
          value={draft.label}
          onChange={(e) => onChange(row.id, { label: e.target.value })}
          className={`w-56 ${adminInput}`}
          disabled={disabled}
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={draft.isActive}
          onChange={(e) => onChange(row.id, { isActive: e.target.checked })}
          disabled={disabled}
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={draft.isSelectable}
          onChange={(e) => onChange(row.id, { isSelectable: e.target.checked })}
          disabled={disabled}
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={draft.isMandatory}
          onChange={(e) => onChange(row.id, { isMandatory: e.target.checked })}
          disabled={disabled}
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={draft.allowsSigning}
          onChange={(e) => onChange(row.id, { allowsSigning: e.target.checked })}
          disabled={disabled}
          title="Firma de documentos"
          aria-label={`Firma documentos — ${row.label}`}
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={draft.canCompleteCase}
          onChange={(e) => onChange(row.id, { canCompleteCase: e.target.checked })}
          disabled={disabled}
          title="Completa el trámite (Director General o quien cierre)"
          aria-label={`Cierra trámite — ${row.label}`}
        />
      </td>
      <td className="max-w-[min(100vw,280px)] px-4 py-3">
        <select
          className={`w-full min-w-[12rem] max-w-[17rem] ${adminInput}`}
          value={supervisorUserId ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            onSupervisorChange(row.id, v === '' ? null : v);
          }}
          disabled={disabled}
          aria-label={`Supervisor titular de ${row.label}`}
        >
          <option value="">Sin supervisor asignado</option>
          {showInactiveTitularOption && titularUser && (
            <option value={titularUser.id} disabled>
              {titularUser.name} ({titularUser.email}) — inactivo
            </option>
          )}
          {activeAreaSupervisors.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.email})
            </option>
          ))}
        </select>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <button
          type="button"
          onClick={() => void onRequestDelete(row)}
          disabled={disabled || deleteDisabled}
          title="Eliminar esta área"
          className={adminBtnDangerOutline}
        >
          <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Eliminar
        </button>
      </td>
    </tr>
  );
}
