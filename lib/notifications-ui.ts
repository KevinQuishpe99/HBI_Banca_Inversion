/** Emoji por tipo de notificación (campana y avisos flotantes). */
export function getNotificationEmoji(type: string): string {
  switch (type) {
    case 'CASE_SUBMITTED':
    case 'CASE_RESUBMITTED':
      return '📥';
    case 'CASE_APPROVED':
      return '✅';
    case 'CASE_RETURNED':
    case 'CASE_REJECTED':
      return '↩️';
    case 'CASE_COMPLETED':
      return '🎉';
    case 'CASE_COMMENT':
      return '💬';
    case 'CASE_HIGH_AMOUNT':
      return '💰';
    default:
      return '📋';
  }
}

export function formatNotificationRelativeTime(date: Date): string {
  const now = new Date();
  const notifDate = new Date(date);
  const diffMs = now.getTime() - notifDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;

  return notifDate.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  });
}
