'use client';

import { useCases } from '@/hooks/useCases';
import { CaseCard } from '@/components/cases/CaseCard';
import { Loader2, Plus } from 'lucide-react';
import Link from 'next/link';
import { useAuth, usePermissions } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { UI_COPY } from '@/lib/ui-copy';

export default function ReviewPage() {
  const { user } = useAuth();
  const { canCreateCase } = usePermissions();
  const isAreaUser = user?.role === 'AREA_USER';
  const isDirectorGeneral = isAreaUser && !!user?.isFinalStepArea;
  const assignedOnly = user?.role === 'AREA_USER';
  const { data: cases, isLoading, error } = useCases(assignedOnly);
  const { data: approvedTodayCount = 0 } = useQuery<number>({
    queryKey: ['review-approved-today', user?.id, isAreaUser],
    enabled: isAreaUser,
    queryFn: async () => {
      const response = await fetch('/api/cases');
      if (!response.ok) return 0;
      const data = await response.json();
      const list = (data?.data || []) as Array<{ updatedAt: string; status: string }>;
      const today = new Date().toDateString();
      return list.filter((c) => {
        const updatedToday = new Date(c.updatedAt).toDateString() === today;
        // Evitar contar trámites recién enviados sin pasar aún por revisión fuerte.
        const reviewedState = c.status !== 'SUBMITTED';
        return updatedToday && reviewedState;
      }).length;
    },
  });

  // Para Director General también mostrar APPROVED (pendiente de firma final).
  const casesInReview = cases?.filter(
    (c) =>
      c.status === 'SUBMITTED' ||
      c.status === 'IN_REVIEW' ||
      (isDirectorGeneral && c.status === 'APPROVED')
  ) || [];

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Revisar trámites</h2>
          <p className="text-gray-600 mt-1">{UI_COPY.reviewSubtitle}</p>
        </div>
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

      {/* Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Pendientes de Revisión</div>
          <div className="text-3xl font-bold text-blue-600 mt-2">
            {casesInReview.length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">{isAreaUser ? 'Aprobados Hoy' : 'Enviados Hoy'}</div>
          <div className="text-3xl font-bold text-green-600 mt-2">
            {isAreaUser
              ? approvedTodayCount
              : cases?.filter((c) => {
                  const today = new Date().toDateString();
                  return new Date(c.createdAt).toDateString() === today;
                }).length || 0}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Devueltos</div>
          <div className="text-3xl font-bold text-orange-600 mt-2">
            {cases?.filter((c) => c.status === 'RETURNED').length || 0}
          </div>
        </div>
      </div>

      {/* Lista de trámites */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Trámites en revisión
        </h3>
        
        {casesInReview.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500">No hay trámites pendientes de revisión</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
            {casesInReview.map((caseData) => (
              <CaseCard key={caseData.id} case={caseData} />
            ))}
          </div>
        )}
      </div>

      {/* Trámites devueltos */}
      {(cases?.filter((c) => c.status === 'RETURNED').length ?? 0) > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Trámites devueltos para corrección
          </h3>
          <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
            {cases
              ?.filter((c) => c.status === 'RETURNED')
              .map((caseData) => (
                <CaseCard key={caseData.id} case={caseData} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
