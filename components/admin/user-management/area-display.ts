import { areaLabels } from './labels';

export type AreaDisplayResolved =
  | { kind: 'empty' }
  | { kind: 'label'; text: string }
  | { kind: 'loading' }
  | { kind: 'fallback'; text: string };

/**
 * Resuelve el nombre visible de un área sin mostrar el id numérico hasta tener el mapa cargado
 * (evita el parpadeo número → texto).
 */
export function resolveAreaDisplayName(
  areaId: string | null | undefined,
  map: Record<string, string>,
  mapLoaded: boolean
): AreaDisplayResolved {
  if (areaId == null || areaId === '') return { kind: 'empty' };
  const fromMap = map[areaId];
  if (fromMap) return { kind: 'label', text: fromMap };
  const leg = areaLabels[areaId as keyof typeof areaLabels];
  if (leg) return { kind: 'label', text: leg };
  if (!mapLoaded) return { kind: 'loading' };
  return { kind: 'fallback', text: areaId };
}
