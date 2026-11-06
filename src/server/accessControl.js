const sessionCookie = 'tleclinic_session';
const publicPaths = ['/login', '/api/auth', '/api/db/health'];

export function getSessionToken(request) {
  return request.cookies?.get(sessionCookie)?.value ||
    request.headers.get('cookie')?.match(/(?:^|;\s*)tleclinic_session=([^;]+)/)?.[1] || null;
}

export function isPublicPath(pathname) {
  return publicPaths.includes(pathname);
}

export function permissionForPath(pathname, method = 'GET') {
  const isRead = method === 'GET' || method === 'HEAD';
  if (pathname.startsWith('/api/notifications')) return null;
  if (pathname === '/api/audit-logs') return 'staff';
  if (pathname === '/api/auth/pin') return 'sales';
  if (pathname === '/' || pathname === '/dashboard') return pathname === '/' ? 'sales' : 'dashboard';
  if (pathname === '/sales-reports') return 'reports';
  if (pathname === '/api/sales') return 'sales';
  if (pathname === '/customers' || pathname === '/pets' || pathname.startsWith('/api/customers') || pathname.startsWith('/api/pets')) return 'customers';
  if (pathname === '/products' || pathname.startsWith('/api/products')) return isRead ? 'sales' : 'catalog';
  if (pathname === '/inventory' || pathname.startsWith('/api/inventory')) {
    return pathname.startsWith('/api/inventory/lots') && isRead ? 'sales' : 'inventory';
  }
  if (pathname === '/purchase-orders' || pathname.startsWith('/api/purchase-orders') || pathname === '/suppliers' || pathname.startsWith('/api/suppliers')) return 'purchasing';
  if (pathname === '/employees' || pathname.startsWith('/api/staff')) return 'staff';
  if (pathname === '/settings' || pathname === '/api/settings') return isRead ? 'sales' : 'settings';
  if (pathname.startsWith('/api/profile-images/')) {
    const entity = pathname.split('/')[3];
    return entity === 'staff' ? 'staff' : entity === 'products' ? 'catalog' : 'customers';
  }
  return null;
}

export function hasPermission(identity, permission) {
  return !permission || identity?.permissions?.all === true || identity?.permissions?.[permission] === true;
}
