import { NextResponse } from 'next/server';
import { getSessionIdentity } from './src/server/authRepository.js';
import { getSessionToken, hasPermission, isPublicPath, permissionForPath } from './src/server/accessControl.js';

export async function proxy(request) {
  const pathname = request.nextUrl.pathname;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = getSessionToken(request);
  if (!token && process.env.NODE_ENV !== 'production') return NextResponse.next();
  if (!token) return unauthorized(request);

  try {
    const identity = await getSessionIdentity(token);
    if (!identity) return unauthorized(request);
    if (!hasPermission(identity, permissionForPath(pathname, request.method))) {
      if (pathname.startsWith('/api/')) return Response.json({ error: 'forbidden' }, { status: 403 });
      return new Response('Forbidden', { status: 403 });
    }
    return NextResponse.next();
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