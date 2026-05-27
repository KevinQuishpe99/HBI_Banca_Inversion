import { NextRequest } from 'next/server';
import { NotificationService } from '@/services/notification.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireAuth } from '@/lib/auth/get-session';

/**
 * PATCH /api/notifications/:id
 * Marca una notificación como leída
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    await NotificationService.markAsRead(id);

    return successResponse({ message: 'Notificación marcada como leída' });
  } catch (error) {
    return errorResponse(error);
  }
}
