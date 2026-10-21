import { NextResponse } from 'next/server';
import { validateSession } from './src/server/authRepository.js';

const publicPaths = ['/login', '/api/auth', '/api/db/health'];

export async function proxy(request) {
  if (process.env.NODE_ENV !== 'production') return NextResponse.next();

  const pathname = request.nextUrl.pathname;
  if (publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const token = request.cookies.get('tleclinic_session')?.value;
  if (!token) return unauthorized(request);

  try {
    if (await validateSession(token)) return NextResponse.next();
    return unauthorized(request);
  } catch {
    if (pathname.startsWith('/api/')) return Response.json({ error: 'database_unavailable' }, { status: 503 });
    return new Response('Database unavailable', { status: 503 });
  }
}

function unauthorized(request) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};