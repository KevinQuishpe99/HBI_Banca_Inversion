import {
  MAX_CASE_CREATE_TOTAL_BYTES,
  MAX_CASE_CREATE_FILES,
} from '@/lib/validations/case-document-files';
import { MAX_FILE_SIZE } from '@/lib/validations/file.schema';

export function formatFileSizeMb(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export type FileSizeEntry = { name: string; bytes: number; formatted: string };

export function listFileSizes(files: File[]): FileSizeEntry[] {
  return files.map((f) => ({
    name: f.name,
    bytes: f.size,
    formatted: formatFileSizeMb(f.size),
  }));
}

export function getHeaviestFile(files: File[]): File | null {
  if (!files.length) return null;
  return files.reduce((a, b) => (b.size > a.size ? b : a));
}

/**
 * Mensaje para error 413 (proxy/servidor rechazó el cuerpo de la petición).
 */
export function buildPayloadTooLargeUserMessage(files: File[]): string {
  const entries = listFileSizes(files);
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const maxPerMb = Math.round(MAX_FILE_SIZE / (1024 * 1024));
  const maxTotalMb = Math.round(MAX_CASE_CREATE_TOTAL_BYTES / (1024 * 1024));
  const heaviest = getHeaviestFile(files);

  const lines =
    entries.length > 0
      ? entries.map((e) => `• ${e.name}: ${e.formatted}`).join('\n')
      : '• (no se detectaron archivos en el formulario)';

  const heaviestLine = heaviest
    ? `\nEl archivo más pesado es «${heaviest.name}» (${formatFileSizeMb(heaviest.size)}).`
    : '';

  const overAppPerFile = files.filter((f) => f.size > MAX_FILE_SIZE);
  const overAppTotal = totalBytes > MAX_CASE_CREATE_TOTAL_BYTES;

  let cause = '';
  if (overAppPerFile.length > 0) {
    cause = `\n\nCausa: ${overAppPerFile.length} archivo(s) superan el límite de la aplicación (${maxPerMb} MB por archivo). Redúzcalos o divida la solicitud.`;
  } else if (overAppTotal) {
    cause = `\n\nCausa: el total (${formatFileSizeMb(totalBytes)}) supera el límite de la aplicación (${maxTotalMb} MB por envío).`;
  } else {
    cause = `\n\nSus archivos están dentro del límite de la aplicación (${maxPerMb} MB por archivo, ${maxTotalMb} MB total, máx. ${MAX_CASE_CREATE_FILES} archivos), pero el servidor web rechazó el envío (error 413). El administrador debe aumentar el límite del proxy (nginx/IIS) o del hosting.`;
  }

  return (
    `No se pudo crear el trámite: el envío fue rechazado por ser demasiado grande (error 413).` +
    `\n\nArchivos adjuntos (${files.length}):\n${lines}` +
    `\n\nTotal enviado: ${formatFileSizeMb(totalBytes)}.` +
    heaviestLine +
    cause
  );
}
