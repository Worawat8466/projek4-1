'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

function formatTime(value) {
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function NotificationCenter() {
  const pathname = usePathname();
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (pathname === '/login') return undefined;
    let active = true;
    let loading = false;

    async function refresh() {
      if (loading) return;
      loading = true;
      try {
        const syncResponse = await fetch('/api/notifications', { method: 'POST' });
        if (!syncResponse.ok) throw new Error('notification_sync_failed');
        const response = await fetch('/api/notifications', { cache: 'no-store' });
        if (!response.ok) throw new Error('notification_load_failed');
        const data = await response.json();
        if (active) {
          setNotifications(data.notifications);
          setUnreadCount(data.unreadCount);
          setLoadError(false);
        }
      } catch {
        if (active) setLoadError(true);
      } finally {
        loading = false;
      }
    }

    refresh();
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [pathname]);

  if (pathname === '/login') return null;

  async function markRead(notificationId = null) {
    const response = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notificationId == null ? { all: true } : { notificationId })
    });
    if (!response.ok) throw new Error('notification_update_failed');
    setNotifications((current) => current.map((item) => notificationId == null || item.id === notificationId ? { ...item, read: true } : item));
    setUnreadCount((current) => notificationId == null ? 0 : Math.max(0, current - (notifications.find((item) => item.id === notificationId)?.read ? 0 : 1)));
  }

  async function openNotification(notification) {
    try { await markRead(notification.id); } catch { setLoadError(true); }
    setOpen(false);
    router.push(notification.href);
  }

  return <div className="notification-center">
    <button className="notification-bell" type="button" aria-label={`การแจ้งเตือน${unreadCount ? ` ${unreadCount} รายการยังไม่อ่าน` : ''}`} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      {unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
    </button>
    {open && <section className="notification-panel" aria-label="การแจ้งเตือน">
      <header className="notification-panel-header">
        <div><h2>การแจ้งเตือน</h2><span>{unreadCount ? `${unreadCount} ยังไม่อ่าน` : 'อ่านครบแล้ว'}</span></div>
        {unreadCount > 0 && <button type="button" onClick={() => markRead().catch(() => setLoadError(true))}>อ่านทั้งหมด</button>}
      </header>
      {loadError && <p className="notification-error" role="status">โหลดการแจ้งเตือนไม่สำเร็จ</p>}
      <div className="notification-list">
        {notifications.map((notification) => <button className={`notification-item ${notification.read ? 'is-read' : ''} severity-${notification.severity}`} type="button" key={notification.id} onClick={() => openNotification(notification)}>
          <span className="notification-marker" aria-hidden="true" />
          <span className="notification-copy"><strong>{notification.title}</strong><span>{notification.message}</span><time dateTime={notification.updatedAt}>{formatTime(notification.updatedAt)}</time></span>
        </button>)}
        {!notifications.length && <p className="notification-empty">ไม่มีรายการที่ต้องติดตาม</p>}
      </div>
    </section>}
  </div>;
}