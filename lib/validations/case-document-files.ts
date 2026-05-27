import { ValidationError } from '@/lib/utils/errors';
import {
  MAX_FILE_SIZE,
  MAX_FILE_NAME_LENGTH,
  truncateFileName,
  validateFileSize,
} from '@/lib/validations/file.schema';

/** Máximo de archivos al crear un trámite */
export const MAX_CASE_CREATE_FILES = 20;

/** Tamaño total aproximado del multipart (alineado con proxyClientMaxBodySize en dev) */
export const MAX_CASE_CREATE_TOTAL_BYTES = 55 * 1024 * 1024;

/**
 * Debe coincidir con `tramites.nombre_archivo_documento VARCHAR(8000)` (migración BD).
 * Si la lista supera 8000 caracteres, se resume con (+N archivos).
 */
export const MAX_TRAMITE_DOCUMENT_FILE_NAME_LENGTH = 8000;

/**
 * Lista de nombres separados por coma para guardar en el trámite.
 */
export function joinDocumentFileNamesForTramite(fileNames: string[]): string {
  if (fileNames.length === 0) return '';
  const joined = fileNames.join(', ');
  if (joined.length <= MAX_TRAMITE_DOCUMENT_FILE_NAME_LENGTH) return joined;
  if (fileNames.length === 1) {
    return truncateFileName(fileNames[0], MAX_TRAMITE_DOCUMENT_FILE_NAME_LENGTH);
  }
  const suffix = ` (+${fileNames.length} archivos)`;
  const head = fileNames[0];
  const maxHead = MAX_TRAMITE_DOCUMENT_FILE_NAME_LENGTH - suffix.length;
  const shortHead = maxHead > 0 ? truncateFileName(head, maxHead) : head.slice(0, Math.max(1, maxHead));
  return `${shortHead}${suffix}`;
}

const ALLOWED_EXT = ['.pdf', '.doc', '.docx'] as const;

export function isAllowedCaseDocumentFileName(fileName: string): boolean {
  const n = fileName.trim().toLowerCase();
  return ALLOWED_EXT.some((ext) => n.endsWith(ext));
}

export function getCaseCreationFileRejectReason(file: File): string | null {
  if (!file.name?.trim()) return 'Archivo sin nombre válido';
  if (!isAllowedCaseDocumentFileName(file.name)) {
    return `"${file.name}": solo PDF, DOC o DOCX`;
  }
  if (!validateFileSize(file.size)) {
    const maxMb = Math.round(MAX_FILE_SIZE / (1024 * 1024));
    return `"${file.name}": supera ${maxMb} MB`;
  }
  if (file.name.length > MAX_FILE_NAME_LENGTH) {
    return `"${file.name}": nombre demasiado largo (máx. ${MAX_FILE_NAME_LENGTH} caracteres)`;
  }
  return null;
}

/** Filtra archivos nuevos y valida límites respecto a los ya adjuntos (formulario). */
export function filterCaseCreationFiles(
  existing: File[],
  incoming: File[]
): { accepted: File[]; rejected: string[] } {
  const rejected: string[] = [];
  const accepted: File[] = [];

  for (const file of incoming) {
    const reason = getCaseCreationFileRejectReason(file);
    if (reason) {
      rejected.push(reason);
      continue;
    }
    accepted.push(file);
  }

  const combined = [...existing, ...accepted];
  if (combined.length > MAX_CASE_CREATE_FILES) {
    rejected.push(`Máximo ${MAX_CASE_CREATE_FILES} archivos por solicitud`);
    return { accepted: [], rejected };
  }

  const totalBytes = combined.reduce((sum, f) => sum + f.size, 0);
  if (totalBytes > MAX_CASE_CREATE_TOTAL_BYTES) {
    const maxTotalMb = Math.round(MAX_CASE_CREATE_TOTAL_BYTES / (1024 * 1024));
    rejected.push(`El tamaño total supera ${maxTotalMb} MB`);
    return { accepted: [], rejected };
  }

  return { accepted, rejected };
}

export function validateCaseCreationDocumentFiles(files: File[]): void {
  if (!files.length) {
    throw new ValidationError('Debe adjuntar al menos un documento');
  }
  if (files.length > MAX_CASE_CREATE_FILES) {
    throw new ValidationError(
      `Puede adjuntar como máximo ${MAX_CASE_CREATE_FILES} archivos por solicitud`
    );
  }

  let totalBytes = 0;
  for (const file of files) {
    if (!file.name?.trim()) {
      throw new ValidationError('Uno de los archivos no tiene nombre válido');
    }
    if (!isAllowedCaseDocumentFileName(file.name)) {
      throw new ValidationError(
        `Formato no permitido: "${file.name}". Solo PDF, DOC o DOCX.`
      );
    }
    if (!validateFileSize(file.size)) {
      const maxMb = Math.round(MAX_FILE_SIZE / (1024 * 1024));
      throw new ValidationError(
        `El archivo "${file.name}" supera el tamaño máximo (${maxMb} MB por archivo).`
      );
    }
    if (file.name.length > MAX_FILE_NAME_LENGTH) {
      throw new ValidationError(
        `El nombre del archivo "${truncateFileName(file.name, 40)}…" es demasiado largo (máx. ${MAX_FILE_NAME_LENGTH} caracteres). Renómbrelo e intente de nuevo.`
      );
    }
    totalBytes += file.size;
  }

  if (totalBytes > MAX_CASE_CREATE_TOTAL_BYTES) {
    const maxTotalMb = Math.round(MAX_CASE_CREATE_TOTAL_BYTES / (1024 * 1024));
    throw new ValidationError(
      `El tamaño total de los archivos supera ${maxTotalMb} MB. Suba menos archivos o reduzca su tamaño.`
    );
  }
}
