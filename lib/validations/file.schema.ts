import { z } from 'zod';

export const uploadFileSchema = z.object({
  caseId: z.string().uuid('ID de trámite inválido'),
  fileName: z.string().min(1, 'El nombre del archivo es requerido'),
  fileType: z.enum(['DOCUMENT', 'IMAGE', 'PDF', 'SPREADSHEET', 'OTHER']),
  description: z.string().optional(),
  signatureReason: z.string().optional(),
  parentFileId: z.string().uuid().optional(),
});

export const fileIdSchema = z.object({
  id: z.string().uuid('ID de archivo inválido'),
});

export const fileCommentBodySchema = z.object({
  content: z.string().trim().min(1, 'Escriba un comentario').max(4000),
});

// Validación de tamaño de archivo (50MB máximo)
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/** Coincide con `files.file_name VARCHAR(255)` en PostgreSQL. */
export const MAX_FILE_NAME_LENGTH = 255;

export function truncateFileName(name: string, max = MAX_FILE_NAME_LENGTH): string {
  const n = name.trim();
  if (n.length <= max) return n;
  const lastDot = n.lastIndexOf('.');
  const ext = lastDot > 0 ? n.slice(lastDot) : '';
  const base = lastDot > 0 ? n.slice(0, lastDot) : n;
  const maxBase = Math.max(1, max - ext.length);
  return base.slice(0, maxBase) + ext;
}

export const validateFileSize = (size: number): boolean => {
  return size <= MAX_FILE_SIZE;
};

/** Extensiones permitidas al subir la copia firmada (Legal / Director / Admin). */
export function isAllowedSignedDocumentFileName(fileName: string): boolean {
  const n = fileName.trim().toLowerCase();
  return n.endsWith('.pdf') || n.endsWith('.doc') || n.endsWith('.docx');
}

export type UploadFileInput = z.infer<typeof uploadFileSchema>;
