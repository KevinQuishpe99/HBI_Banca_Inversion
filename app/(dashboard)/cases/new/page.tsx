'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CreateCaseForm } from '@/components/cases/CreateCaseForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useAuth, usePermissions } from '@/hooks/useAuth';
import { UI_COPY } from '@/lib/ui-copy';

export default function NewCasePage() {
  const { isLoading, user } = useAuth();
  const { canCreateCase } = usePermissions();
  const router = useRouter();
  const backHref = user?.role === 'AREA_USER' ? '/tracking' : '/cases';
  const backLabel = user?.role === 'AREA_USER' ? 'Volver a seguimiento' : 'Volver a trámites';

  useEffect(() => {
    if (isLoading) return;
    if (!canCreateCase()) {
      router.replace(backHref);
    }
  }, [isLoading, canCreateCase, router, backHref]);

  if (isLoading) return null;
  if (!canCreateCase()) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </Link>
        <h2 className="text-2xl font-bold text-gray-900">Crear nuevo trámite</h2>
        <p className="text-gray-600 mt-1">{UI_COPY.newCaseSubtitle}</p>
      </div>

      <CreateCaseForm />
    </div>
  );
}
