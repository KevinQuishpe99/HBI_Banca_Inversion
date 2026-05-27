'use client';

import { Suspense, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useCaseDetail, CaseDetailLoadError } from '@/hooks/useCaseDetail';
import { useWorkflowProgress } from '@/hooks/useFlow';
import { useAuth } from '@/hooks/useAuth';
import { useCaseDetailPermissions } from '@/hooks/useCaseDetailPermissions';
import { CaseDetailView } from '@/components/cases/case-detail/CaseDetailView';
import { SupervisionReviewProvider } from '@/components/cases/SupervisionReviewPanel';
function CaseDetailPageContent({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const {
    data: caseData,
    isLoading: caseLoading,
    isError: caseError,
    error: caseErr,
    refetch: refetchCase,
  } = useCaseDetail(id);
  const { data: workflow, isLoading: workflowLoading, refetch: refetchWorkflow } =
    useWorkflowProgress(id);

  const {
    canApprove,
    canReturn,
    canUploadFiles,
    canDeleteNonInitialFiles,
    canCommentFile,
    canSubmit,
  } = useCaseDetailPermissions(user, caseData ?? undefined, workflow);

  /** Query seguimiento: solo consulta para áreas que no sean de firma ni paso final. */
  const seguimiento = searchParams.get('seguimiento') === '1';
  const readOnlySeguimiento =
    seguimiento &&
    user?.role === 'AREA_USER' &&
    user.areaId != null &&
    !user.isSigningArea &&
    !user.isFinalStepArea;

  const effectiveCanApprove = readOnlySeguimiento ? false : canApprove;
  const effectiveCanReturn = readOnlySeguimiento ? false : canReturn;
  const effectiveCanDeleteNonInitialFiles = readOnlySeguimiento ? false : canDeleteNonInitialFiles;
  /** Seguimiento solo lectura para usuarios de área “intermedios”; el titular del área sigue pudiendo comentar/anotar PDF en su turno. */
  const effectiveCanCommentFile =
    readOnlySeguimiento && !user?.isAreaSupervisor ? false : canCommentFile;

  const handleApprovalSuccess = () => {
    router.push('/review');
  };

  const handleSubmitSuccess = () => {
    refetchCase();
    refetchWorkflow();
  };

  if (caseLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (caseError && caseErr instanceof CaseDetailLoadError) {
    const isForbidden = caseErr.status === 403;
    const isUnauthorized = caseErr.status === 401;
    const isNotFound = caseErr.status === 404;
    return (
      <div
        className={[
          'rounded-lg border p-4',
          isForbidden
            ? 'border-amber-200 bg-amber-50 text-amber-950'
            : isUnauthorized
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-red-200 bg-red-50 text-red-800',
        ].join(' ')}
      >
        <p className="font-medium">
          {isNotFound
            ? 'Trámite no encontrado'
            : isUnauthorized
              ? 'Sesión requerida'
              : isForbidden
                ? 'No puede acceder a este trámite'
                : 'No se pudo cargar el trámite'}
        </p>
        <p className="mt-2 text-sm opacity-90">{caseErr.message}</p>
        {!isUnauthorized ? (
          <button
            type="button"
            onClick={() => void refetchCase()}
            className="mt-4 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-900 shadow ring-1 ring-gray-300 hover:bg-gray-50"
          >
            Reintentar
          </button>
        ) : null}
      </div>
    );
  }

  if (caseError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <p className="font-medium">Error al cargar el trámite</p>
        <p className="mt-2 text-sm">{caseErr instanceof Error ? caseErr.message : 'Error desconocido'}</p>
        <button
          type="button"
          onClick={() => void refetchCase()}
          className="mt-4 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-900 shadow ring-1 ring-gray-300 hover:bg-gray-50"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">Trámite no encontrado</div>
    );
  }

  return (
    <SupervisionReviewProvider caseId={id} caseData={caseData} user={user} onSuccess={handleSubmitSuccess}>
      <CaseDetailView
        caseId={id}
        caseData={caseData}
        user={user}
        canApprove={effectiveCanApprove}
        canReturn={effectiveCanReturn}
        canUploadFiles={canUploadFiles}
        canDeleteNonInitialFiles={effectiveCanDeleteNonInitialFiles}
        canCommentFile={effectiveCanCommentFile}
        canSubmit={canSubmit}
        workflow={workflow}
        workflowLoading={workflowLoading}
        onApprovalSuccess={handleApprovalSuccess}
        onSubmitSuccess={handleSubmitSuccess}
      />
    </SupervisionReviewProvider>
  );
}

export default function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <CaseDetailPageContent id={id} />
    </Suspense>
  );
}
