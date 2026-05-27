import { esModoDemo } from '@/lib/demo/app-mode';
import { FALLBACK_META_CASE_STATUSES } from '@/lib/status-config';

/** Respuestas vacías/quemadas para endpoints /api/meta en demo (sin BD). */
export const META_DEMO = {
  areas: [] as Array<Record<string, unknown>>,
  documentTypes: [] as Array<{ code: string; label: string; sortOrder: number }>,
  signatureTypes: [] as Array<{ code: string; label: string; sortOrder: number }>,
  templateTypes: [] as Array<{ code: string; label: string; sortOrder: number }>,
  caseStatuses: FALLBACK_META_CASE_STATUSES,
};

export function enModoDemoMeta(): boolean {
  return esModoDemo();
}
