import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiErrorMessage } from '@/lib/api/parse-api-error';
import { UploadFileDTO } from '@/types/file.types';

/**
 * Hook para subir archivos
 */
export function useUploadFile() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { lockMessage: 'Subiendo archivo…' },
    mutationFn: async (data: UploadFileDTO & { file: File }) => {
      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('caseId', data.caseId);
      formData.append('fileType', data.fileType);
      
      if (data.description) formData.append('description', data.description);
      if (data.signatureReason) formData.append('signatureReason', data.signatureReason);
      if (data.parentFileId) formData.append('parentFileId', data.parentFileId);

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          getApiErrorMessage(
            error as Record<string, unknown>,
            'No se pudo subir el archivo. Verifique el tamaño y el formato.',
            { httpStatus: response.status, uploadFiles: [data.file] }
          )
        );
      }

      const result = await response.json();
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['files', variables.caseId] });
      queryClient.invalidateQueries({ queryKey: ['case', variables.caseId] });
    },
  });
}
