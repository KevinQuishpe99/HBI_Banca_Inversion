'use client';

import { useMemo } from 'react';
import type { CaseWithCreator } from '@/types/case.types';
import type { User } from 'next-auth';
import type { WorkflowProgressView } from '@/types/flow.types';

type SessionUser = Pick<NonNullable<User>, 'id' | 'role'> & {
  areaId?: number;
  isAreaSupervisor?: boolean;
  isSigningArea?: boolean;
  isFinalStepArea?: boolean;
};

export function useCaseDetailPermissions(
  user: SessionUser | undefined,
  caseData: CaseWithCreator | null | undefined,
  workflow: WorkflowProgressView[] | undefined
) {
  return useMemo(() => {
    /** Solo el paso en curso (IN_PROGRESS), alineado con el servidor: `userHasActiveReviewStep` usa el primer área pendiente, no las cola en PENDING. */
    const hasMyActiveStep = !!(
      user &&
      user.role === 'AREA_USER' &&
      user.areaId != null &&
      user.isAreaSupervisor &&
      Array.isArray(workflow) &&
      workflow.some(
        (s) => s.stepStatus === 'IN_PROGRESS' && s.requiredArea === String(user.areaId)
      )
    );

    const supervisionAssignPending = !!(
      caseData &&
      caseData.routingFlow === 'SUPERVISION_CHAIN' &&
      !caseData.supervisionCompleted &&
      caseData.status === 'SUBMITTED'
    );

    const canApprove = !!(
      user &&
      caseData &&
      !supervisionAssignPending &&
      (user.role === 'ADMIN' || hasMyActiveStep)
    );

    /** Usuarios de área no suben archivos. Solo creador (devuelto) o admin. */
    const canUploadFiles = !!(
      user &&
      caseData &&
      (user.role === 'ADMIN' ||
        (user.id === caseData.createdBy && caseData.status === 'RETURNED'))
    );

    const canSubmit = !!(
      user &&
      caseData &&
      (user.role === 'ADMIN' || user.id === caseData.createdBy) &&
      caseData.status === 'RETURNED'
    );

    /** Eliminar archivos no iniciales: en revisión solo áreas finales/firma (además de admin y reglas del creador). */
    const canDeleteNonInitialFiles = !!(
      user &&
      caseData &&
      (user.role === 'ADMIN' ||
        (user.role === 'AREA_USER' &&
          hasMyActiveStep &&
          caseData.status !== 'RETURNED' &&
          user.isSigningArea) ||
        (user.id === caseData.createdBy &&
          caseData.status === 'RETURNED' &&
          caseData.returnAllowFileUpdate))
    );

    /** Comentarios en PDF: mismas reglas que el servidor (turno activo), sin paralelo entre finales. */
    const finalAreaParallelReview = false;

    /** Comercial: miembros del área pueden comentar el documento si el trámite ya tiene circuito definido y Comercial participa. */
    const comercialMayCommentOnFiles =
      user?.role === 'AREA_USER' &&
      user.areaId != null &&
      caseData &&
      (caseData.status === 'SUBMITTED' || caseData.status === 'IN_REVIEW') &&
      Array.isArray(caseData.commentEligibleAreaIds) &&
      caseData.commentEligibleAreaIds.includes(user.areaId);

    const canCommentFile = !!(
      user &&
      caseData &&
      (user.role === 'ADMIN' ||
        comercialMayCommentOnFiles ||
        (user.role === 'AREA_USER' &&
          (caseData.status === 'SUBMITTED' || caseData.status === 'IN_REVIEW') &&
          (hasMyActiveStep || finalAreaParallelReview)))
    );

    return {
      canApprove,
      canReturn: canApprove,
      canUploadFiles,
      canSubmit,
      canDeleteNonInitialFiles,
      canCommentFile,
    };
  }, [user, caseData, workflow]);
}
