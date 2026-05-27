'use client';

import { useMemo, useState } from 'react';
import { useCases } from '@/hooks/useCases';
import { Loader2, Plus, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useAuth, usePermissions } from '@/hooks/useAuth';
import { CaseListItem } from '@/components/cases/CaseListItem';
export default function TrackingPage() {
  const { user } = useAuth();
  const { canCreateCase } = usePermissions();
  const isAreaUser = user?.role === 'AREA_USER';
  const { data: cases, isLoading, error } = useCases(false);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const list = cases || [];
    const query = q.trim().toLowerCase();
    if (!query) return list;
    return list.filter((c) => {
      return (
        c.title.toLowerCase().includes(query) ||
        c.caseNumber.toLowerCase().includes(query) ||
        (c.description || '').toLowerCase().includes(query)
      );
    });
  }, [cases, q]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        Error al cargar trámites: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Trámites</h2>
        {isAreaUser && canCreateCase() ? (
          <Link
            href="/cases/new"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" />
            <span>Nuevo trámite</span>
          </Link>
        ) : null}
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar…"
          className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
        />
        {q && (
          <button
            onClick={() => setQ('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            title="Limpiar"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
          No hay trámites que coincidan.
        </div>
      ) : (
        <div className="space-y-3">
          {(filtered || []).map((c) => (
            <CaseListItem key={c.id} case={c} href={`/cases/${c.id}?seguimiento=1`} />
          ))}
        </div>
      )}
    </div>
  );
}

