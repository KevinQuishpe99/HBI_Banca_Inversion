/** En demo HBI, tramiteId apunta a operaciones mock (`mock-op-*`). */
export function rutaNotificacion(tramiteId: string): string {
  if (tramiteId.startsWith('mock-op-')) {
    return `/operaciones/${tramiteId}`;
  }
  return `/cases/${tramiteId}`;
}
