'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Swal, escapeSwalHtml, swalConfirmDanger } from '@/lib/ui/swal';
import {
  adminBtnDangerOutline,
  adminBtnSecondary,
  adminCard,
  adminInput,
  adminLabel,
  adminTableHead,
  adminTableHeadRight,
  adminToolbar,
} from '@/lib/ui/admin-ui';
import type { AdminCasesListResponse, CaseStatus, CaseWithCreator } from '@/types/case.types';

const STATUS_OPTIONS: { value: '' | CaseStatus; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'SUBMITTED', label: 'Enviado' },
  { value: 'IN_REVIEW', label: 'En revisión' },
  { value: 'APPROVED', label: 'Revisado' },
  { value: 'RETURNED', label: 'Devuelto' },
  { value: 'COMPLETED', label: 'Completado' },
];

function statusLabel(s: CaseStatus): string {
  const row = STATUS_OPTIONS.find((o) => o.value === s);
  return row?.label ?? s;
}

/**
 * Lista paginada de trámites con filtros y eliminación individual (solo si ALLOW_DEV_DATA_WIPE=true). Requiere rol ADMIN.
 */
export function AdminWipeTramitesPanel() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [searchDraft, setSearchDraft] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | CaseStatus>('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchDraft.trim()), 400);
    return () => clearTimeout(t);
  }, [searchDraft]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [debouncedSearch, statusFilter, limit]);

  const { data: wipeMeta } = useQuery<{ enabled: boolean }>({
    queryKey: ['admin-wipe-tramites-meta'],
    queryFn: async () => {
      const res = await fetch('/api/admin/wipe-tramites', { credentials: 'include' });
      if (!res.ok) return { enabled: false };
      const json = await res.json();
      return { enabled: Boolean(json?.data?.enabled) };
    },
  });

  const listQuery = useQuery<AdminCasesListResponse>({
    queryKey: ['admin-cases', page, limit, debouncedSearch, statusFilter],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set('page', String(page));
      sp.set('limit', String(limit));
      if (debouncedSearch) sp.set('q', debouncedSearch);
      if (statusFilter) sp.set('status', statusFilter);
      const res = await fetch(`/api/admin/cases?${sp.toString()}`, { credentials: 'include' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j?.error === 'string' ? j.error : 'No se pudo cargar la lista');
      }
      const json = await res.json();
      return json.data as AdminCasesListResponse;
    },
    enabled: Boolean(wipeMeta?.enabled),
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit) || 1), [total, limit]);

  useEffect(() => {
    if (page > totalPages) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const deleteMutation = useMutation({
    mutationFn: async (tramiteId: string) => {
      const res = await fetch(`/api/admin/wipe-tramites/${encodeURIComponent(tramiteId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : 'No se pudo eliminar el trámite');
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-cases'] });
      await queryClient.invalidateQueries({ queryKey: ['cases'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-routing-flows'] });
      await Swal.fire({
        icon: 'success',
        title: 'Trámite eliminado',
        confirmButtonColor: '#2563eb',
      });
    },
    onError: async (e: unknown) => {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: e instanceof Error ? e.message : 'Error',
        confirmButtonColor: '#2563eb',
      });
    },
  });

  if (!wipeMeta?.enabled) {
    return (
      <section className={adminCard}>
        <div className={adminToolbar}>
          <h2 className="text-sm font-semibold text-admin-text-strong">Eliminar trámites</h2>
        </div>
        <p className="px-4 py-4 text-sm text-admin-text-secondary">
          Esta acción no está habilitada en el servidor. Defina{' '}
          <code className="rounded border border-admin-border bg-admin-muted px-1.5 py-0.5 text-xs text-admin-text">
            ALLOW_DEV_DATA_WIPE=true
          </code>{' '}
          en el entorno y reinicie la aplicación.
        </p>
      </section>
    );
  }

  return (
    <section className={adminCard}>
      <div className={adminToolbar}>
        <div>
          <h2 className="text-sm font-semibold text-admin-text-strong">Eliminar trámites</h2>
          <p className="mt-0.5 text-xs text-admin-text-secondary">
            Las eliminaciones no se pueden deshacer. Filtre la lista y confirme en cada fila.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-admin-border p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1 sm:min-w-[200px]">
          <label htmlFor="admin-delete-tramites-q" className={adminLabel}>
            Buscar
          </label>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-placeholder" />
            <input
              id="admin-delete-tramites-q"
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Número, título, Odoo, cliente…"
              className={`${adminInput} pl-9`}
              autoComplete="off"
            />
          </div>
        </div>
        <div className="w-full sm:w-auto sm:min-w-[200px]">
          <label htmlFor="admin-delete-tramites-status" className={adminLabel}>
            Estado
          </label>
          <select
            id="admin-delete-tramites-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | CaseStatus)}
            className={`${adminInput} mt-1 py-2`}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.label + String(o.value)} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-auto sm:min-w-[120px]">
          <label htmlFor="admin-delete-tramites-limit" className={adminLabel}>
            Por página
          </label>
          <select
            id="admin-delete-tramites-limit"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className={`${adminInput} mt-1 py-2`}
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {listQuery.isLoading ? (
        <div className="flex items-center gap-2 px-4 py-6 text-sm text-admin-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin text-admin-primary" aria-hidden />
          Cargando trámites…
        </div>
      ) : listQuery.isError ? (
        <p className="px-4 py-4 text-sm text-admin-text">
          {listQuery.error instanceof Error ? listQuery.error.message : 'Error al cargar'}
        </p>
      ) : items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-admin-text-secondary">
          {total === 0 && !debouncedSearch && !statusFilter
            ? 'No hay trámites registrados.'
            : 'No hay resultados con los filtros actuales.'}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-admin-border text-sm">
              <thead>
                <tr>
                  <th className={adminTableHead}>Número</th>
                  <th className={adminTableHead}>Título</th>
                  <th className={adminTableHead}>Estado</th>
                  <th className={adminTableHead}>Creador</th>
                  <th className={adminTableHeadRight}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border bg-admin-surface">
                {items.map((c: CaseWithCreator) => (
                  <tr key={c.id} className="transition-colors hover:bg-admin-muted">
                    <td className="whitespace-nowrap px-4 py-3 text-admin-text-secondary">{c.caseNumber}</td>
                    <td className="max-w-[min(28rem,50vw)] px-4 py-3">
                      <Link
                        href={`/cases/${c.id}`}
                        className="font-medium text-admin-text underline decoration-admin-primary/30 underline-offset-2 hover:text-admin-primary"
                      >
                        {c.title}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-admin-text-secondary">{statusLabel(c.status)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-admin-text-secondary">
                      {c.creatorName ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={deleteMutation.isPending}
                        aria-label={`Eliminar trámite ${c.caseNumber}`}
                        onClick={async () => {
                          const ok = await swalConfirmDanger({
                            title: '¿Eliminar este trámite?',
                            html: `<p class="text-left text-sm text-gray-700">Se borrarán archivos, comentarios y registros ligados a este expediente. No se puede deshacer.</p><p class="mt-2 text-left text-sm font-medium text-gray-900">${escapeSwalHtml(c.caseNumber)} — ${escapeSwalHtml(c.title)}</p>`,
                            confirmButtonText: 'Sí, eliminar',
                          });
                          if (!ok) return;
                          deleteMutation.mutate(c.id);
                        }}
                        className={adminBtnDangerOutline}
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        )}
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <nav
            className="flex flex-col items-stretch justify-between gap-3 border-t border-admin-border px-4 py-4 text-sm text-admin-text-secondary sm:flex-row sm:items-center"
            aria-label="Paginación"
          >
            <p className="text-center sm:text-left">
              {total === 0 ? (
                '0 trámites'
              ) : (
                <>
                  {(page - 1) * limit + 1}–{Math.min(page * limit, total)} de {total}
                </>
              )}
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || listQuery.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={`${adminBtnSecondary} px-3 py-1.5 text-sm`}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Anterior
              </button>
              <span className="min-w-[7rem] text-center text-xs text-admin-text-secondary">
                Página {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || listQuery.isFetching}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={`${adminBtnSecondary} px-3 py-1.5 text-sm`}
              >
                Siguiente
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </nav>
        </>
      )}
    </section>
  );
}
