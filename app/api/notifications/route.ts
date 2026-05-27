import { NextRequest } from 'next/server';
import { NotificationService } from '@/services/notification.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireAuth } from '@/lib/auth/get-session';

/**
 * GET /api/notifications
 * Obtiene las notificaciones del usuario actual
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');

    const notifications = await NotificationService.getUserNotifications(
      session.user.id,
      unreadOnly,
      limit
    );

    return successResponse(notifications);
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * PATCH /api/notifications
 * Marca todas las notificaciones como leídas
 */
export async function PATCH() {
  try {
    const session = await requireAuth();

    await NotificationService.markAllAsRead(session.user.id);

    return successResponse({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (error) {
    return errorResponse(error);
  }
}
