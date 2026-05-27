'use client';

import { Send, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/useToast';
import { Toast } from '@/components/shared/Toast';
import { Swal } from '@/lib/ui/swal';
import { getApiErrorMessage } from '@/lib/api/parse-api-error';

interface SubmitCaseButtonProps {
  caseId: string;
  onSuccess?: () => void;
}

export function SubmitCaseButton({ caseId, onSuccess }: SubmitCaseButtonProps) {
  const queryClient = useQueryClient();
  const { toasts, hideToast, success, error } = useToast();

  const submitMutation = useMutation({
    meta: { lockMessage: 'Enviando trámite a revisión…' },
    mutationFn: async () => {
      const response = await fetch(`/api/cases/${caseId}/submit`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          getApiErrorMessage(errorData as Record<string, unknown>, 'No se pudo enviar el trámite a revisión.', {
            httpStatus: response.status,
          })
        );
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['workflow', caseId] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      
      success('Trámite enviado exitosamente. Ahora está en revisión.');
      
      setTimeout(() => {
        onSuccess?.();
      }, 1000);
    },
    onError: (err: Error) => {
      error(err.message);
    },
  });

  const askAndSubmit = () => {
    void Swal.fire({
      title: 'Confirmar envío',
      text: '¿Está seguro de que desea reenviar este trámite para revisión? Una vez enviado, las áreas asignadas podrán revisarlo y usted podrá ver el estado de cada revisión.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmar envío',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#6b7280',
      reverseButtons: true,
    }).then((r) => {
      if (r.isConfirmed) submitMutation.mutate();
    });
  };

  return (
    <>
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <Send className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Trámite devuelto
            </h3>
            <p className="text-gray-700 mb-4">
              Este trámite fue devuelto para correcciones. Luego de actualizar la información y/o archivos, puede reenviarlo para revisión.
            </p>
            
            <button
              type="button"
              onClick={askAndSubmit}
              disabled={submitMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Reenviar a revisión
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Toasts */}
      {toasts.map((toast, i) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          zIndex={200 + i}
          onClose={() => hideToast(toast.id)}
        />
      ))}
    </>
  );
}
