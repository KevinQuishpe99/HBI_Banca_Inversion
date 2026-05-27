import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { canAccessCase } from '@/lib/auth/get-session';
import { subscribeCaseChannel } from '@/lib/realtime/case-events';
import { errorResponse } from '@/lib/utils/response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/cases/:id/events
 * Server-Sent Events (push HTTP): actualizaciones en tiempo casi real sin polling agresivo.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await params;

    const row = await query<{ created_by: string; current_area_id: number | null }>(
      `SELECT t.creado_por AS created_by, t.area_actual_id AS current_area_id
       FROM tramites t
       WHERE t.id = $1`,
      [caseId]
    );
    if (row.rows.length === 0) {
      return new Response('Not found', { status: 404 });
    }

    await canAccessCase(row.rows[0].created_by, row.rows[0].current_area_id ?? undefined);

    const encoder = new TextEncoder();

    let unsubscribe: (() => void) | undefined;
    let ping: ReturnType<typeof setInterval> | undefined;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (line: string) => {
          try {
            controller.enqueue(encoder.encode(line));
          } catch {
            /* stream cerrado */
          }
        };

        send('retry: 3000\n\n');

        unsubscribe = subscribeCaseChannel(caseId, () => {
          send(`data: ${JSON.stringify({ type: 'update', t: Date.now() })}\n\n`);
        });

        ping = setInterval(() => {
          send(': ping\n\n');
        }, 25_000);
      },
      cancel() {
        if (ping) clearInterval(ping);
        unsubscribe?.();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
