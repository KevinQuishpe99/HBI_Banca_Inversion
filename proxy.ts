import '@/lib/auth/auth-env';
import { withAuth, type NextRequestWithAuth } from 'next-auth/middleware';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { usaDatosQuemadosHbi } from '@/lib/hbi/mock-config';
import { rateLimitResponse } from '@/lib/security/rate-limit';
import { resolveAuthSecret } from '@/lib/auth/auth-env';

const authMiddleware = withAuth(
  function proxy(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    const demoHbi = usaDatosQuemadosHbi();

    if (!demoHbi && path === '/' && token?.role === 'ADMIN') {
      return NextResponse.redirect(new URL('/admin/users', req.url));
    }

    if (!demoHbi && path === '/' && token?.role === 'AREA_USER') {
      return NextResponse.redirect(new URL('/review', req.url));
    }

    if (path.startsWith('/admin') && token?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', req.url));
    }

    if (path.startsWith('/review')) {
      if (!token?.role || (token.role !== 'AREA_USER' && token.role !== 'ADMIN')) {
        return NextResponse.redirect(new URL('/', req.url));
      }
    }

    if (path.startsWith('/tracking')) {
      if (!token?.role || (token.role !== 'AREA_USER' && token.role !== 'ADMIN')) {
        return NextResponse.redirect(new URL('/', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    secret: resolveAuthSecret(),
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;

        if (/\.(svg|png|jpe?g|gif|webp|ico|css|js|woff2?|ttf|eot)$/i.test(path)) {
          return true;
        }

        if (path.startsWith('/_next/static') || path.startsWith('/_next/image')) {
          return true;
        }

        if (
          path.startsWith('/login') ||
          path.startsWith('/register') ||
          path.startsWith('/api/auth') ||
          path.startsWith('/api/meta')
        ) {
          return true;
        }

        return !!token;
      },
    },
    pages: {
      signIn: '/login',
    },
  }
);

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  const limited = rateLimitResponse(req);
  if (limited) return limited;
  return authMiddleware(req as NextRequestWithAuth, event);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
