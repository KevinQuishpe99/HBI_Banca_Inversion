import { NextRequest, NextResponse } from 'next/server';
import { evaluateAllDeadlineAlerts } from '@/services/deadline-alerts.service';

/**
 * GET /api/cron/deadline-alerts
 *
 * Invocable por un scheduler externo (Vercel Cron, GitHub Actions, Azure Timer, etc.).
 * Protegido por un token secreto en el header `Authorization: Bearer <CRON_SECRET>`.
 *
 * Ejemplo de cURL:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://app.example.com/api/cron/deadline-alerts
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await evaluateAllDeadlineAlerts();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('[cron/deadline-alerts]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error interno' },
      { status: 500 }
    );
  }
}
