'use client';

import { CheckCircle, Loader2, RotateCcw, Building2, Flag } from 'lucide-react';
import { useFlow } from '@/hooks/useFlow';
import { FlowValidationError } from '@/lib/utils/flow-api-error';
import { Swal, swalAlertSuccess } from '@/lib/ui/swal';
import { ReviewActionsDescription } from '@/components/flow/ReviewActionsDescription';

type ApproveIntent = 'legal-director' | 'director-finalize' | 'revisado';

/** Exportados para reutilizar el mismo modal de devolución (p. ej. fase de supervisión). */
export const RETURN_HTML_STANDARD = `
<p style="text-align:left;font-size:14px;color:#374151">Motivo y comentarios: mínimo 10 caracteres cada uno.</p>
<label style="display:block;text-align:left;margin-top:10px;font-weight:600;color:#111827">Motivo de devolución *</label>
<input id="swal-return-reason" class="swal2-input" placeholder="Ej.: Documentos incompletos" autocomplete="off" />
<label style="display:block;text-align:left;margin-top:10px;font-weight:600;color:#111827">Comentarios detallados *</label>
<textarea id="swal-return-comments" class="swal2-textarea" placeholder="Explica qué debe corregir el usuario…"></textarea>
<div style="margin-top:14px;text-align:left;font-size:14px">
  <label style="cursor:pointer"><input type="checkbox" id="swal-allow-files" style="margin-right:8px;vertical-align:middle"/>Habilitar para que el solicitante actualice los archivos</label>
</div>
`;

export const RETURN_HTML_LEGAL = `
<p style="text-align:left;font-size:14px;color:#374151">El motivo de devolución debe tener al menos 10 caracteres.</p>
<label style="display:block;text-align:left;margin-top:10px;font-weight:600;color:#111827">Motivo de devolución *</label>
<input id="swal-return-reason" class="swal2-input" placeholder="Ej.: Documentos incompletos" autocomplete="off" />
<label style="display:block;text-align:left;margin-top:10px;font-weight:600;color:#111827">Observaciones legales</label>
<textarea id="swal-legal-obs" class="swal2-textarea" placeholder="Observaciones (Legal / Director General)…"></textarea>
<label style="display:block;text-align:left;margin-top:10px;font-weight:600;color:#111827">Recomendaciones de acciones con el cliente / proveedor</label>
<textarea id="swal-legal-rec" class="swal2-textarea" placeholder="Recomendaciones para gestionar con cliente o proveedor…"></textarea>
<div style="margin-top:10px;text-align:left;font-size:14px">
  <span style="font-weight:600;display:block;margin-bottom:6px;color:#111827">¿Necesita agendar reunión?</span>
  <label style="margin-right:16px;cursor:pointer"><input type="radio" name="swal-meeting" value="no" checked style="margin-right:6px"/>No</label>
  <label style="cursor:pointer"><input type="radio" name="swal-meeting" value="yes" style="margin-right:6px"/>Sí</label>
</div>
<div style="margin-top:14px;text-align:left;font-size:14px">
  <label style="cursor:pointer"><input type="checkbox" id="swal-allow-files" style="margin-right:8px;vertical-align:middle"/>Habilitar para que el solicitante actualice los archivos</label>
</div>
`;

interface ApprovalActionsProps {
  caseId: string;
  canApprove: boolean;
  canReturn: boolean;
  userArea?: string | null;
  userRole?: string;
  isSigningArea?: boolean;
  isFinalStepArea?: boolean;
  /** Cierra trámite (`puede_completar_tramite`); mismo criterio que en sesión. */
  puedeCompletarTramite?: boolean;
  onSuccess?: () => void;
  /** Reutiliza este mismo bloque en la fase de asignación de circuito (supervisor). */
  supervisionAssignmentMode?: boolean;
  onSupervisionApprove?: () => Promise<void>;
  supervisionApproveDisabled?: boolean;
  supervisionApproveLoading?: boolean;
}

function approveModalCopy(intent: ApproveIntent): { title: string; confirmLabel: string } {
  if (intent === 'legal-director') {
    return { title: 'Pasar al Director General', confirmLabel: 'Confirmar y pasar a Director' };
  }
  if (intent === 'director-finalize') {
    return { title: 'Finalizar trámite', confirmLabel: 'Confirmar finalización' };
  }
  return { title: 'Aprobar paso', confirmLabel: 'Confirmar' };
}

export function ApprovalActions({
  caseId,
  canApprove,
  canReturn,
  userRole,
  isSigningArea,
  isFinalStepArea,
  puedeCompletarTramite,
  onSuccess,
  supervisionAssignmentMode = false,
  onSupervisionApprove,
  supervisionApproveDisabled = false,
  supervisionApproveLoading = false,
}: ApprovalActionsProps) {
  const { approveStep, returnCase, legalCompleteEarly, isApproving, isReturning, isLegalCompleting } =
    useFlow();

  const isLegalUser = userRole === 'AREA_USER' && !!isSigningArea;
  const isDirectorUser =
    userRole === 'AREA_USER' && (!!isFinalStepArea || !!puedeCompletarTramite);
  const isLegalStyleReturn = isLegalUser || isDirectorUser;

  const reviewDescriptionContext = supervisionAssignmentMode
    ? 'supervision'
    : isLegalUser
      ? 'legal'
      : isDirectorUser
        ? 'director'
        : 'area';

  const openApproveDialog = (intent: ApproveIntent) => {
    const { title, confirmLabel } = approveModalCopy(intent);
    void Swal.fire({
      title,
      html: '<p style="text-align:left;color:#4b5563;font-size:14px">Comentarios opcionales sobre la revisión.</p>',
      input: 'textarea',
      inputPlaceholder: 'Agregar comentarios sobre la revisión…',
      showCancelButton: true,
      confirmButtonText: confirmLabel,
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#16a34a',
      cancelButtonColor: '#6b7280',
      reverseButtons: true,
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async () => {
        const comments = Swal.getInput()?.value ?? '';
        try {
          await approveStep({ caseId, comments });
        } catch (err: unknown) {
          if (!(err instanceof FlowValidationError)) {
            console.error('Error al aprobar:', err);
          }
          const msg = err instanceof Error ? err.message : 'No se pudo registrar la acción. Intente nuevamente.';
          Swal.showValidationMessage(msg);
          return false;
        }
      },
    }).then((r) => {
      if (!r.isConfirmed) return;
      const title =
        intent === 'legal-director'
          ? 'Paso registrado'
          : intent === 'director-finalize'
            ? 'Trámite finalizado'
            : 'Revisión registrada';
      const text =
        intent === 'legal-director'
          ? 'Legal aprobó. El trámite pasa a Director General.'
          : intent === 'director-finalize'
            ? 'El trámite quedó finalizado correctamente.'
            : 'Avanzando al siguiente paso del flujo.';
      void swalAlertSuccess(title, text).then(() => onSuccess?.());
    });
  };

  const openLegalCompleteDialog = () => {
    void Swal.fire({
      title: 'Trámite completado',
      html: '<p style="text-align:left;color:#4b5563;font-size:14px">El trámite quedará como <strong>completado</strong> sin pasar por Director General. Los pasos pendientes se omitirán en el flujo.</p>',
      input: 'textarea',
      inputPlaceholder: 'Motivo o notas internas…',
      showCancelButton: true,
      confirmButtonText: 'Confirmar completado',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#6b7280',
      reverseButtons: true,
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async () => {
        const comments = Swal.getInput()?.value ?? '';
        try {
          await legalCompleteEarly({ caseId, comments });
        } catch (err: unknown) {
          if (!(err instanceof FlowValidationError)) {
            console.error('Error al completar:', err);
          }
          const msg = err instanceof Error ? err.message : 'No se pudo completar el trámite.';
          Swal.showValidationMessage(msg);
          return false;
        }
      },
    }).then((r) => {
      if (!r.isConfirmed) return;
      void swalAlertSuccess('Trámite completado', 'Completado por Legal según lo indicado.').then(() =>
        onSuccess?.()
      );
    });
  };

  const openReturnDialog = () => {
    const html = isLegalStyleReturn ? RETURN_HTML_LEGAL : RETURN_HTML_STANDARD;
    void Swal.fire({
      title: 'Devolver trámite',
      html,
      width: '36em',
      showCancelButton: true,
      confirmButtonText: 'Confirmar devolución',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d97706',
      cancelButtonColor: '#6b7280',
      reverseButtons: true,
      showLoaderOnConfirm: true,
      focusConfirm: false,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async () => {
        const reason =
          (document.getElementById('swal-return-reason') as HTMLInputElement | null)?.value?.trim() ?? '';
        if (reason.length < 10) {
          Swal.showValidationMessage('El motivo de devolución debe tener al menos 10 caracteres.');
          return false;
        }
        try {
          if (isLegalStyleReturn) {
            const legalObservations =
              (document.getElementById('swal-legal-obs') as HTMLTextAreaElement | null)?.value ?? '';
            const legalClientRecommendations =
              (document.getElementById('swal-legal-rec') as HTMLTextAreaElement | null)?.value ?? '';
            const meetingEl = document.querySelector(
              'input[name="swal-meeting"]:checked'
            ) as HTMLInputElement | null;
            const legalScheduleMeeting = meetingEl?.value === 'yes';
            const allowFileUpdate =
              (document.getElementById('swal-allow-files') as HTMLInputElement | null)?.checked ?? false;
            await returnCase({
              caseId,
              returnReason: reason,
              allowFileUpdate,
              variant: 'legal',
              legalObservations,
              legalClientRecommendations,
              legalScheduleMeeting,
            });
          } else {
            const comments =
              (document.getElementById('swal-return-comments') as HTMLTextAreaElement | null)?.value?.trim() ??
              '';
            if (comments.length < 10) {
              Swal.showValidationMessage('Los comentarios deben tener al menos 10 caracteres.');
              return false;
            }
            const allowFileUpdate =
              (document.getElementById('swal-allow-files') as HTMLInputElement | null)?.checked ?? false;
            await returnCase({
              caseId,
              comments,
              returnReason: reason,
              allowFileUpdate,
              variant: 'standard',
            });
          }
        } catch (err: unknown) {
          if (!(err instanceof FlowValidationError)) {
            console.error('Error al devolver:', err);
          }
          const msg = err instanceof Error ? err.message : 'Error al devolver el trámite.';
          Swal.showValidationMessage(msg);
          return false;
        }
      },
    }).then((r) => {
      if (!r.isConfirmed) return;
      void swalAlertSuccess('Trámite devuelto', 'El usuario recibirá una notificación.').then(() => {
        onSuccess?.();
      });
    });
  };

  if (!supervisionAssignmentMode && !canApprove && !canReturn) {
    return null;
  }

  if (supervisionAssignmentMode) {
    const busyApprove = supervisionApproveLoading || isReturning;
    return (
      <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow sm:p-6">
        <h3 className="text-base font-semibold text-gray-900 sm:text-lg">Acciones de revisión</h3>
        <ReviewActionsDescription context={reviewDescriptionContext} />
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={busyApprove || supervisionApproveDisabled || !onSupervisionApprove}
            onClick={() => void onSupervisionApprove?.()}
            className="flex min-h-[2.5rem] flex-1 items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {supervisionApproveLoading ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
            ) : (
              <CheckCircle className="h-5 w-5 shrink-0" />
            )}
            Aprobar
          </button>
          <button
            type="button"
            disabled={supervisionApproveLoading || isReturning}
            onClick={openReturnDialog}
            className="flex min-h-[2.5rem] flex-1 items-center justify-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isReturning ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
            ) : (
              <RotateCcw className="h-5 w-5 shrink-0" />
            )}
            Devolver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow sm:p-6">
      <h3 className="text-base font-semibold text-gray-900 sm:text-lg">Acciones de revisión</h3>
      <ReviewActionsDescription context={reviewDescriptionContext} />

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap">
        {canApprove && isLegalUser ? (
          <>
            <button
              type="button"
              onClick={openLegalCompleteDialog}
              disabled={isLegalCompleting || isApproving || isReturning}
              className="flex min-h-[2.5rem] flex-1 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Flag className="h-5 w-5 shrink-0" />
              Trámite completado
            </button>
            <button
              type="button"
              onClick={() => openApproveDialog('legal-director')}
              disabled={isLegalCompleting || isApproving || isReturning}
              className="flex min-h-[2.5rem] flex-1 items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Building2 className="h-5 w-5 shrink-0" />
              Pasar al Director General
            </button>
          </>
        ) : null}

        {canApprove && !isLegalUser ? (
          <button
            type="button"
            onClick={() => openApproveDialog(isDirectorUser ? 'director-finalize' : 'revisado')}
            disabled={isLegalCompleting || isApproving || isReturning}
            className="flex min-h-[2.5rem] flex-1 items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle className="h-5 w-5 shrink-0" />
            {isDirectorUser ? 'Finalizar trámite' : 'Aprobar'}
          </button>
        ) : null}

        {canReturn ? (
          <button
            type="button"
            onClick={openReturnDialog}
            disabled={isLegalCompleting || isApproving || isReturning}
            className="flex min-h-[2.5rem] flex-1 items-center justify-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="h-5 w-5 shrink-0" />
            Devolver
          </button>
        ) : null}
      </div>
    </div>
  );
}
