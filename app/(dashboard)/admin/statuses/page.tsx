'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { Toast } from '@/components/shared/Toast';
import { STATUS_VARIANT_KEYS, STATUS_VARIANT_CLASSES } from '@/lib/status-config';
import {
  adminBtnPrimary,
  adminCard,
  adminInput,
  adminPageDesc,
  adminPageTitle,
  adminTableHead,
  adminToolbar,
} from '@/lib/ui/admin-ui';

type Row = {
  id: number;
  code: string;
  label: string;
  variant: string;
  sortOrder: number;
  isActive: boolean;
};

function StatusTable({
  title,
  queryKey,
  adminPath,
  metaKey,
  notifySuccess,
  notifyError,
}: {
  title: string;
  queryKey: string;
  adminPath: string;
  metaKey: string;
  notifySuccess: (msg: string) => void;
  notifyError: (msg: string) => void;
}) {
  const queryClient = useQueryClient();
  const [variantDraft, setVariantDraft] = useState<Record<number, string>>({});

  const { data, isLoading, isError, error: loadError } = useQuery<Row[]>({
    queryKey: [queryKey],
    queryFn: async () => {
      const res = await fetch(adminPath, { credentials: 'include' });
      if (!res.ok) throw new Error('Error al cargar');
      const json = await res.json();
      return json.data as Row[];
    },
  });

  const rows = useMemo(() => data ?? [], [data]);

  const anyDirty = useMemo(() => {
    return rows.some((row) => {
      const v = variantDraft[row.id] ?? row.variant;
      return v !== row.variant;
    });
  }, [rows, variantDraft]);

  const saveAllMutation = useMutation({
    mutationFn: async (): Promise<number> => {
      const dirtyRows = rows.filter((row) => {
        const v = variantDraft[row.id] ?? row.variant;
        return v !== row.variant;
      });
      if (dirtyRows.length === 0) return 0;
      for (const row of dirtyRows) {
        const variant = variantDraft[row.id] ?? row.variant;
        const res = await fetch(adminPath, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: row.id, variant }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Error al guardar «${row.label}»`);
      }
      return dirtyRows.length;
    },
    onSuccess: (savedCount) => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      queryClient.invalidateQueries({ queryKey: ['meta', metaKey] });
      setVariantDraft({});
      if (savedCount > 0) {
        notifySuccess(savedCount === 1 ? 'Color guardado' : 'Colores guardados');
      }
    },
    onError: (e: Error) => notifyError(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-admin-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={`${adminCard} p-4`}>
        <p className="text-sm font-medium text-admin-text-strong">No se pudo cargar esta tabla.</p>
        <p className="mt-1 text-sm text-admin-text-secondary">
          {loadError instanceof Error
            ? loadError.message
            : 'Compruebe que sea administrador y que la base tenga las tablas de configuración.'}
        </p>
      </div>
    );
  }

  return (
    <div className={adminCard}>
      <div className={adminToolbar}>
        <h3 className="text-sm font-semibold text-admin-text-strong">{title}</h3>
        <button
          type="button"
          onClick={() => saveAllMutation.mutate()}
          disabled={saveAllMutation.isPending || !anyDirty}
          className={`${adminBtnPrimary} px-3 py-2`}
        >
          {saveAllMutation.isPending ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <Save className="h-4 w-4 shrink-0" aria-hidden />
          )}
          Guardar
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-admin-border text-sm">
          <thead>
            <tr>
              <th className={adminTableHead}>Etiqueta</th>
              <th className={adminTableHead}>Color</th>
              <th className={adminTableHead}>Vista</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-border bg-admin-surface">
            {rows.map((row) => {
              const variant = variantDraft[row.id] ?? row.variant;
              const colorClass = STATUS_VARIANT_CLASSES[variant] ?? STATUS_VARIANT_CLASSES.gray;
              return (
                <tr key={row.id} className="transition-colors hover:bg-admin-muted">
                  <td className="max-w-[200px] px-4 py-3 text-admin-text">{row.label}</td>
                  <td className="px-4 py-3">
                    <select
                      value={variant}
                      onChange={(ev) =>
                        setVariantDraft((s) => ({ ...s, [row.id]: ev.target.value }))
                      }
                      disabled={saveAllMutation.isPending}
                      className={`${adminInput} min-w-[8rem] py-2`}
                    >
                      {STATUS_VARIANT_KEYS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
                      {row.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-4 py-4 text-sm text-admin-text-secondary">No hay datos de configuración.</p>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminStatusesPage() {
  const { toasts, hideToast, success, error } = useToast();

  return (
    <div className="space-y-6">
      <div>
        <h1 className={adminPageTitle}>Estados y etiquetas</h1>
        <p className={adminPageDesc}>Solo se puede ajustar el color.</p>
      </div>

      <StatusTable
        title="Estados del trámite"
        queryKey="admin-case-statuses"
        adminPath="/api/admin/case-statuses"
        metaKey="case-statuses"
        notifySuccess={success}
        notifyError={error}
      />

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
