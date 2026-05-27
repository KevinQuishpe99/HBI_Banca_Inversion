import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

type Bucket = { count: number; windowStart: number };

const store = new Map<string, Bucket>();
const PRUNE_EVERY = 200;
let ops = 0;

function parseLimit(raw: string | undefined, fallback: number): number {
  const n = parseInt(String(raw ?? '').trim(), 10);
  return !Number.isNaN(n) && n >= 1 ? n : fallback;
}

function prune(now: number) {
  if (store.size < 8000) return;
  for (const [k, v] of store) {
    if (now - v.windowStart > 120_000) store.delete(k);
  }
}

function hit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  ops++;
  if (ops % PRUNE_EVERY === 0) prune(now);

  let b = store.get(key);
  if (!b || now - b.windowStart > windowMs) {
    b = { count: 1, windowStart: now };
    store.set(key, b);
    return false;
  }
  b.count += 1;
  return b.count > limit;
}

function clientKey(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  const first = xff?.split(',')[0]?.trim();
  return first || req.headers.get('x-real-ip') || 'unknown';
}

export function rateLimitResponse(req: NextRequest): NextResponse | null {
  const path = req.nextUrl.pathname;
  if (!path.startsWith('/api/')) return null;

  const ip = clientKey(req);
  const windowMs = Math.min(
    300_000,
    Math.max(5_000, parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10) || 60_000)
  );

  if (path.startsWith('/api/auth')) {
    const limit = parseLimit(process.env.RATE_LIMIT_AUTH_MAX, 45);
    if (hit(`auth:${ip}`, limit, windowMs)) {
      const retry = Math.ceil(windowMs / 1000);
      return new NextResponse(null, {
        status: 429,
        headers: { 'Retry-After': String(retry) },
      });
    }
    return null;
  }

  const limit = parseLimit(process.env.RATE_LIMIT_API_MAX, 200);
  if (hit(`api:${ip}`, limit, windowMs)) {
    const retry = Math.ceil(windowMs / 1000);
    return new NextResponse(null, {
      status: 429,
      headers: { 'Retry-After': String(retry) },
    });
  }

  return null;
}
