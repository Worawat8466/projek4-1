'use client';

import { useEffect, useState } from 'react';

const permissionByPath = {
  '/': 'sales',
  '/dashboard': 'dashboard',
  '/customers': 'customers',
  '/pets': 'pets',
  '/products': 'catalog',
  '/inventory': 'inventory',
  '/purchase-orders': 'purchasing',
  '/suppliers': 'purchasing',
  '/sales-reports': 'reports',
  '/employees': 'staff',
  '/settings': 'settings',
  '/notifications': null
};

export default function RoleAwareNavigation({ items, activeLabel }) {
  const [permissions, setPermissions] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/auth')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (active) setPermissions(data?.session?.permissions || null);
      })
      .catch(() => { if (active) setPermissions(null); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  const visibleItems = !ready || !permissions || permissions.all
    ? items
    : items.filter(([, href]) => {
      const permission = permissionByPath[href];
      return !permission || permissions[permission] === true;
    });

  return <nav>{visibleItems.map(([label, href]) => <a className={label === activeLabel ? 'active' : ''} href={href} key={href}>{label}</a>)}</nav>;
}
