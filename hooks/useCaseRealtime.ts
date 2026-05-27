'use client';

import { useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Conexión SSE al trámite: cuando otro usuario o otra pestaña cambia datos,
 * se invalidan las queries y la UI se actualiza casi al instante (sin depender solo de polling).
 */
export function useCaseRealtime(caseId: string | undefined) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  const invalidateCaseData = useCallback(() => {
    if (!caseId) return;
    void queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    void queryClient.invalidateQueries({ queryKey: ['workflow', caseId] });
    void queryClient.invalidateQueries({ queryKey: ['files', caseId] });
    void queryClient.invalidateQueries({ queryKey: ['case-review-presence', caseId] });
    void queryClient.invalidateQueries({ queryKey: ['files-to-sign', caseId] });
    void queryClient.invalidateQueries({ queryKey: ['file-comments', caseId] });
    void queryClient.invalidateQueries({ queryKey: ['case-history', caseId] });
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    void queryClient.invalidateQueries({ queryKey: ['cases'] });
  }, [caseId, queryClient]);

  useEffect(() => {
    if (!caseId) return;

    const es = new EventSource(`/api/cases/${caseId}/events`);

    es.onopen = () => setConnected(true);
    es.onmessage = () => {
      invalidateCaseData();
    };
    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [caseId, invalidateCaseData]);

  return { connected };
}
