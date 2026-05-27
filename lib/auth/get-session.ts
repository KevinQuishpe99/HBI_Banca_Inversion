import { getServerSession } from 'next-auth';
import { authOptions } from './auth.config';
import { UnauthorizedError, ForbiddenError } from '@/lib/utils/errors';
import { UserRole } from '@/types/user.types';
import { FlowService } from '@/services/flow.service';
import { isUserSupervisorForArea } from '@/lib/auth/area-supervisor';

/**
 * Obtiene la sesión del usuario en el servidor
 */
export async function getSession() {
  const session = await getServerSession(authOptions);
  return session;
}

/**
 * Obtiene la sesión y lanza error si no está autenticado
 */
export async function requireAuth() {
  const session = await getSession();
  
  if (!session || !session.user) {
    throw new UnauthorizedError('Debe iniciar sesión');
  }
  
  return session;
}

/**
 * Requiere un rol específico
 */
export async function requireRole(roles: UserRole | UserRole[]) {
  const session = await requireAuth();
  const roleArray = Array.isArray(roles) ? roles : [roles];
  
  if (!roleArray.includes(session.user.role)) {
    throw new ForbiddenError('No tiene permisos para realizar esta acción');
  }
  
  return session;
}

/**
 * Verifica si el usuario puede acceder a un trámite (solo lectura)
 */
export async function canAccessCase(caseCreatorId: string, caseAreaId?: number) {
  void caseAreaId;
  const session = await requireAuth();
  const user = session.user;
  
  if (user.role === 'ADMIN') return true;
  if (user.id === caseCreatorId) return true;
  if (user.role === 'AREA_USER') return true;
  
  throw new ForbiddenError('No tiene acceso a este trámite');
}

/**
 * Verifica si el usuario puede interactuar con un trámite (subir archivos, aprobar, devolver)
 */
export async function canInteractWithCase(caseCreatorId: string, caseAreaId?: number) {
  const session = await requireAuth();
  const user = session.user;
  
  if (user.role === 'ADMIN') return true;
  if (user.id === caseCreatorId) return true;
  
  if (user.role === 'AREA_USER') {
    if (caseAreaId && user.areaId === caseAreaId) return true;
    throw new ForbiddenError('Solo puede interactuar con trámites asignados a su área');
  }
  
  throw new ForbiddenError('No tiene permisos para interactuar con este trámite');
}

/**
 * Comentarios por archivo en revisión: administrador o área con turno de revisión activo.
 */
export async function assertCanPostFileComment(
  user: { id: string; role: UserRole; areaId?: number },
  caseId: string,
  caseStatus: string
): Promise<void> {
  if (user.role === 'ADMIN') return;

  if (user.role !== 'AREA_USER' || user.areaId == null) {
    throw new ForbiddenError('No tiene permiso para comentar archivos en este trámite');
  }

  if (caseStatus !== 'SUBMITTED' && caseStatus !== 'IN_REVIEW') {
    throw new ForbiddenError('Solo puede comentar durante la revisión del trámite');
  }

  const { getFinalStepAreaIds } = await import('@/lib/db/area-config-flags');
  const finals = await getFinalStepAreaIds();
  const isFinalArea = user.areaId != null && finals.includes(user.areaId);

  if (isFinalArea) {
    const dgParallel = await FlowService.directorGeneralMayCommentFilesInParallelReview(caseId);
    const supervisorAreaRef = user.areaId;
    if (
      dgParallel &&
      supervisorAreaRef != null &&
      (await isUserSupervisorForArea(user.id, supervisorAreaRef))
    )
      return;
  }

  if (user.areaId != null && (await FlowService.comercialAreaMayCommentFiles(caseId, user.areaId))) {
    return;
  }

  const allowed = await FlowService.userHasActiveReviewStep(
    caseId,
    user.areaId,
    user.id
  );
  if (!allowed) {
    throw new ForbiddenError(
      'Solo puede comentar cuando su área tiene un paso de revisión pendiente o en curso'
    );
  }
}
