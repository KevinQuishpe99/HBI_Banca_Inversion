'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminAreasQuery, type AdminAreaConfig } from '@/hooks/useAdminAreasQuery';
import { invalidateAreaCaches } from '@/lib/query/invalidate-area-caches';
import { Loader2, FilePlus } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { Toast } from '@/components/shared/Toast';
import { swalAlertError } from '@/lib/ui/swal';
import {
  adminBtnPrimary,
  adminCard,
  adminPageDesc,
  adminPageTitle,
  adminTableHead,
  adminToolbar,
} from '@/lib/ui/admin-ui';

export default function AdminSupervisorCrearTramitesPage() {
  const queryClient = useQueryClient();
  const { toasts, hideToast, success } = useToast();
  const serverSigRef = useRef<string>('');

  const [draft, setDraft] = useState<Record<number, boolean>>({});

  const { data, isLoading, isError, error: loadError, refetch } = useAdminAreasQuery();

  useEffect(() => {
    if (!data || data.length === 0) return;
    const sig = data.map((r) => `${r.id}:${r.supervisorCanCreateCase ? '1' : '0'}`).join('|');
    if (sig !== serverSigRef.current) {
      serverSigRef.current = sig;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(Object.fromEntries(data.map((r) => [r.id, r.supervisorCanCreateCase])));
    }
  }, [data]);

  const hasChanges = useMemo(() => {
    if (!data) return false;
    return data.some((r) => (draft[r.id] ?? r.supervisorCanCreateCase) !== r.supervisorCanCreateCase);
  }, [data, draft]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error('No se pudo guardar');
      const changes = data.filter(
        (r) => (draft[r.id] ?? r.supervisorCanCreateCase) !== r.supervisorCanCreateCase,
      );
      for (const r of changes) {
        const next = draft[r.id] ?? r.supervisorCanCreateCase;
        const res = await fetch('/api/admin/areas', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: r.id,
            supervisorCanCreateCase: next,
          }),
        });
        if (!res.ok) throw new Error('No se pudo guardar');
        await res.json();
      }
    },
    onSuccess: async () => {
      await invalidateAreaCaches(queryClient);
      let list = queryClient.getQueryData<AdminAreaConfig[]>(['admin-areas']);
      if (!list?.length) {
        const r = await refetch();
        list = r.data ?? undefined;
      }
      if (list?.length) {
        const sig = list.map((r) => `${r.id}:${r.supervisorCanCreateCase ? '1' : '0'}`).join('|');
        serverSigRef.current = sig;
        setDraft(Object.fromEntries(list.map((r) => [r.id, r.supervisorCanCreateCase])));
      }
      success('Cambios guardados');
    },
    onError: async () => {
      await swalAlertError('No se pudo guardar');
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-admin-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={adminCard}>
        <div className={adminToolbar}>
          <h1 className="text-sm font-semibold text-admin-text-strong">Error al cargar</h1>
        </div>
        <div className="p-4">
          <p className="text-sm text-admin-text-secondary">
            {loadError instanceof Error ? loadError.message : 'Error desconocido'}
          </p>
          <button type="button" onClick={() => void refetch()} className={`${adminBtnPrimary} mt-4`}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className={adminPageTitle}>Decisión de nuevos trámites</h1>
        <p className={`${adminPageDesc} max-w-2xl`}>
          Por área: si el <span className="font-medium">supervisor titular</span> (usuarios) puede usar{' '}
          <span className="font-medium">Nuevo trámite</span>. No afecta al resto del área; sin supervisor no aplica.
          Pulse <span className="font-medium">Guardar</span>.
        </p>
      </div>

      <div className={`${adminCard} flex justify-end p-4`}>
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !hasChanges}
          className={`${adminBtnPrimary} px-4 py-2`}
        >
          {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      <div className={adminCard}>
        <table className="min-w-full divide-y divide-admin-border text-sm">
          <thead>
            <tr>
              <th className={adminTableHead}>Área</th>
              <th className={adminTableHead}>Supervisor</th>
              <th className={`${adminTableHead} text-center`}>
                <span className="inline-flex items-center justify-center gap-1">
                  <FilePlus className="h-4 w-4 shrink-0 text-admin-primary" aria-hidden />
                  Puede crear trámites
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-border bg-admin-surface">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-admin-text-secondary">
                  No hay áreas registradas en el sistema. Cree áreas en «Configuración de Áreas».
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id} className="transition-colors hover:bg-admin-muted">
                <td className="px-4 py-3">
                  <div className="font-medium text-admin-text">{row.label}</div>
                </td>
                <td className="px-4 py-3 text-admin-text-secondary">
                  {row.supervisorName ? (
                    <>
                      {row.supervisorName}
                      {row.supervisorEmail ? (
                        <span className="block text-xs text-admin-placeholder">{row.supervisorEmail}</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-admin-placeholder">Sin supervisor asignado</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-admin-border text-admin-primary focus:ring-admin-primary"
                      checked={draft[row.id] ?? row.supervisorCanCreateCase}
                      disabled={saveMutation.isPending}
                      title={
                        !row.supervisorId
                          ? 'Quedará vigente cuando asigne un supervisor en Gestión de usuarios'
                          : undefined
                      }
                      onChange={(e) => {
                        setDraft((d) => ({ ...d, [row.id]: e.target.checked }));
                      }}
                    />
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toasts.map((t, i) => (
        <Toast key={t.id} message={t.message} type={t.type} zIndex={200 + i} onClose={() => hideToast(t.id)} />
      ))}
    </div>
  );
}
