import { NotificationService } from '@/services/notification.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireAuth } from '@/lib/auth/get-session';

/**
 * GET /api/notifications/unread-count
 * Obtiene el contador de notificaciones no leídas
 */
export async function GET() {
  try {
    const session = await requireAuth();

    const count = await NotificationService.getUnreadCount(session.user.id);

    return successResponse({ count });
  } catch (error) {
    return errorResponse(error);
  }
}
