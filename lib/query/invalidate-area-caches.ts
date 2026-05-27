import type { QueryClient } from '@tanstack/react-query';

/**
 * Tras crear/editar/borrar un área, invalida todas las consultas que dependen de la lista de áreas.
 */
export function invalidateAreaCaches(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['admin-areas'] }),
    queryClient.invalidateQueries({ queryKey: ['meta-areas'] }),
    queryClient.invalidateQueries({ queryKey: ['area-labels'] }),
    queryClient.invalidateQueries({ queryKey: ['admin-routing-flows'] }),
  ]);
}
