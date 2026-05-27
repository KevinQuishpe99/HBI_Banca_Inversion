import { useQuery } from '@tanstack/react-query';
import { CaseWithCreator } from '@/types/case.types';

/** Error con código HTTP del GET /api/cases/:id para mostrar el mensaje correcto en la UI. */
export class CaseDetailLoadError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'CaseDetailLoadError';
  }
}

/**
 * Hook para obtener el detalle de un trámite
 */
export function useCaseDetail(caseId: string) {
  return useQuery<CaseWithCreator>({
    queryKey: ['case', caseId],
    queryFn: async () => {
      const response = await fetch(`/api/cases/${caseId}`, { credentials: 'include' });
      let body: { success?: boolean; error?: string; data?: CaseWithCreator } = {};
      try {
        body = await response.json();
      } catch {
        /* cuerpo vacío o no JSON */
      }
      if (!response.ok) {
        const msg =
          typeof body.error === 'string' && body.error.length > 0
            ? body.error
            : 'Error al cargar trámite';
        throw new CaseDetailLoadError(msg, response.status);
      }
      return body.data as CaseWithCreator;
    },
    enabled: !!caseId,
  });
}
