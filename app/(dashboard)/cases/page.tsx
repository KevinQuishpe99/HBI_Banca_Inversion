'use client';

import { useState, useMemo } from 'react';
import { useCases } from '@/hooks/useCases';
import { CaseListItem } from '@/components/cases/CaseListItem';
import Link from 'next/link';
import { Plus, Loader2, Search, X } from 'lucide-react';
import { usePermissions } from '@/hooks/useAuth';

export default function CasesPage() {
  const { canCreateCase } = usePermissions();
  const { data: cases, isLoading, error } = useCases();
  const [searchQuery, setSearchQuery] = useState('');

  // Filtrar trámites según la búsqueda
  const filteredCases = useMemo(() => {
    if (!cases) return [];
    if (!searchQuery.trim()) return cases;

    const query = searchQuery.toLowerCase();
    return cases.filter((caseData) => {
      return (
        caseData.title.toLowerCase().includes(query) ||
        caseData.caseNumber.toLowerCase().includes(query) ||
        caseData.description?.toLowerCase().includes(query)
      );
    });
  }, [cases, searchQuery]);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Trámites</h2>
        </div>
        {canCreateCase() ? (
          <Link
            href="/cases/new"
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Nuevo trámite</span>
            <span className="sm:hidden">Nuevo</span>
          </Link>
        ) : null}
      </div>

      {/* Barra de búsqueda */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar…"
          className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Resultados de búsqueda */}
      {searchQuery && (
        <div className="text-sm text-gray-600">
          {filteredCases.length === 0 ? (
            <p>No se encontraron trámites que coincidan con "{searchQuery}"</p>
          ) : (
            <p>
              {filteredCases.length} {filteredCases.length === 1 ? 'trámite encontrado' : 'trámites encontrados'}
            </p>
          )}
        </div>
      )}

      {cases && cases.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 mb-4">No tienes trámites aún</p>
          {canCreateCase() ? (
            <Link
              href="/cases/new"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Crear tu primer trámite
            </Link>
          ) : null}
        </div>
      ) : filteredCases.length === 0 && searchQuery ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 mb-2">No se encontraron trámites</p>
          <p className="text-sm text-gray-400">Intenta con otros términos de búsqueda</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCases.map((caseData) => (
            <CaseListItem key={caseData.id} case={caseData} />
          ))}
        </div>
      )}
    </div>
  );
}
