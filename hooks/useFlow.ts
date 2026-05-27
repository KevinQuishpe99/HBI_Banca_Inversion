import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { WorkflowProgressView } from '@/types/flow.types';
import { throwFlowApiError } from '@/lib/utils/flow-api-error';

/**
 * Hook para obtener el progreso del workflow
 */
export function useWorkflowProgress(caseId: string) {
  return useQuery<WorkflowProgressView[]>({
    queryKey: ['workflow', caseId],
    queryFn: async () => {
      const response = await fetch('/api/flow/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId }),
      });
      
      if (!response.ok) throw new Error('Error al cargar workflow');
      const data = await response.json();
      return data.data;
    },
    enabled: !!caseId,
  });
}

/**
 * Hook para aprobar un paso
 */
export function useApproveStep() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { lockMessage: 'Aprobando revisión…' },
    mutationFn: async ({ caseId, comments }: { caseId: string; comments?: string }) => {
      const response = await fetch('/api/flow/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, comments }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throwFlowApiError(err, 'Error al aprobar');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', variables.caseId] });
      queryClient.invalidateQueries({ queryKey: ['case', variables.caseId] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
  });
}

/**
 * Hook para devolver un trámite
 */
export function useReturnCase() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { lockMessage: 'Devolviendo trámite…' },
    mutationFn: async (vars: {
      caseId: string;
      returnReason: string;
      allowFileUpdate?: boolean;
      variant: 'standard' | 'legal';
      comments?: string;
      legalObservations?: string;
      legalClientRecommendations?: string;
      legalScheduleMeeting?: boolean;
    }) => {
      const body =
        vars.variant === 'legal'
          ? {
              caseId: vars.caseId,
              returnReason: vars.returnReason,
              allowFileUpdate: vars.allowFileUpdate ?? false,
              variant: 'legal' as const,
              legalObservations: vars.legalObservations ?? '',
              legalClientRecommendations: vars.legalClientRecommendations ?? '',
              legalScheduleMeeting: vars.legalScheduleMeeting ?? false,
            }
          : {
              caseId: vars.caseId,
              returnReason: vars.returnReason,
              allowFileUpdate: vars.allowFileUpdate ?? false,
              variant: 'standard' as const,
              comments: vars.comments ?? '',
            };

      const response = await fetch('/api/flow/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throwFlowApiError(err, 'Error al devolver trámite');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', variables.caseId] });
      queryClient.invalidateQueries({ queryKey: ['case', variables.caseId] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['file-comments', variables.caseId] });
    },
  });
}

/**
 * Legal completa el trámite sin pasar por Director General
 */
export function useLegalCompleteEarly() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { lockMessage: 'Completando trámite…' },
    mutationFn: async ({ caseId, comments }: { caseId: string; comments?: string }) => {
      const response = await fetch('/api/flow/legal-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, comments }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throwFlowApiError(err, 'Error al completar el trámite');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', variables.caseId] });
      queryClient.invalidateQueries({ queryKey: ['case', variables.caseId] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
  });
}

/**
 * Hook combinado para acciones de flujo
 */
export function useFlow() {
  const approveMutation = useApproveStep();
  const returnMutation = useReturnCase();
  const legalCompleteMutation = useLegalCompleteEarly();

  return {
    approveStep: approveMutation.mutateAsync,
    returnCase: returnMutation.mutateAsync,
    legalCompleteEarly: legalCompleteMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    isReturning: returnMutation.isPending,
    isLegalCompleting: legalCompleteMutation.isPending,
  };
}
