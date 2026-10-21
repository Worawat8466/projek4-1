'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const menuItems = [
  ['Dashboard', '/dashboard'], ['หน้าร้าน', '/'], ['ลูกค้า', '/customers'], ['สัตว์เลี้ยง', '/pets'],
  ['สินค้า', '/products'], ['คลังสินค้า', '/inventory'], ['สั่งซื้อสินค้า', '/purchase-orders'],
  ['ผู้จัดจำหน่าย', '/suppliers'], ['สรุปยอดขาย', '/sales-reports'], ['จัดการพนักงาน', '/employees'], ['ตั้งค่า', '/settings'],
  ['การแจ้งเตือน', '/notifications']
];

const filters = [
  ['all', 'ทั้งหมด'], ['unread', 'ยังไม่อ่าน'], ['read', 'อ่านแล้ว']
];

function formatTime(value) {
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [updating, setUpdating] = useState(false);

  const refresh = useCallback(async (sync = false) => {
    try {
      if (sync) {
        const syncResponse = await fetch('/api/notifications', { method: 'POST' });
        if (!syncResponse.ok) throw new Error('notification_sync_failed');
      }
      const response = await fetch('/api/notifications', { cache: 'no-store' });
      if (!response.ok) throw new Error('notification_load_failed');
      const data = await response.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh(true);
    const interval = window.setInterval(() => refresh(), 60_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const filteredNotifications = useMemo(() => notifications.filter((notification) => (
    filter === 'all' || (filter === 'unread' ? !notification.read : notification.read)
  )), [filter, notifications]);

  async function markRead(notificationId = null) {
    setUpdating(true);
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notificationId == null ? { all: true } : { notificationId })
      });
      if (!response.ok) throw new Error('notification_update_failed');
      setNotifications((current) => current.map((item) => notificationId == null || item.id === notificationId ? { ...item, read: true } : item));
      setUnreadCount((current) => notificationId == null
        ? 0
        : Math.max(0, current - (notifications.find((item) => item.id === notificationId)?.read ? 0 : 1)));
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setUpdating(false);
    }
  }

  async function openNotification(notification) {
    if (!notification.read) await markRead(notification.id);
    router.push(notification.href);
  }

  return <div className="notifications-page">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">TC</div><strong>Tle<span>Clinic</span></strong></div>
      <nav>{menuItems.map(([label, href]) => <a className={href === '/notifications' ? 'active' : ''} href={href} key={href}>{label}</a>)}</nav>
    </aside>
    <main className="notifications-main">
      <header className="notifications-header">
        <div><p>รายการที่ต้องติดตาม</p><h1>การแจ้งเตือน</h1></div>
        <button className="notifications-refresh" type="button" disabled={loading || updating} onClick={() => refresh(true)} title="รีเฟรชรายการ">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M5.6 9A7 7 0 0 1 17 6l3 6M4 12l3 6a7 7 0 0 0 11.4-3" /></svg>
          รีเฟรช
        </button>
      </header>
      <section className="notifications-toolbar" aria-label="ตัวกรองการแจ้งเตือน">
        <div className="notifications-filters" role="group" aria-label="สถานะการอ่าน">
          {filters.map(([value, label]) => <button className={filter === value ? 'selected' : ''} type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
        <span className="notifications-total">{filter === 'unread' ? unreadCount : filteredNotifications.length} รายการ</span>
        {unreadCount > 0 && <button className="notifications-mark-all" type="button" disabled={updating} onClick={() => markRead()}>อ่านทั้งหมด</button>}
      </section>
      {loadError && <p className="notifications-error" role="alert">โหลดหรือบันทึกการแจ้งเตือนไม่สำเร็จ</p>}
      <section className="notifications-list" aria-label="รายการแจ้งเตือน" aria-busy={loading}>
        {filteredNotifications.map((notification) => <article className={`notifications-row severity-${notification.severity} ${notification.read ? 'is-read' : ''}`} key={notification.id}>
          <span className="notifications-row-marker" aria-hidden="true" />
          <div className="notifications-row-content">
            <button className="notifications-row-title" type="button" onClick={() => openNotification(notification)}>{notification.title}</button>
            <p>{notification.message}</p>
            <time dateTime={notification.updatedAt}>{formatTime(notification.updatedAt)}</time>
          </div>
          <div className="notifications-row-actions">
            {!notification.read && <span className="notifications-unread-label">ยังไม่อ่าน</span>}
            {!notification.read && <button type="button" disabled={updating} onClick={() => markRead(notification.id)}>ทำเครื่องหมายว่าอ่านแล้ว</button>}
            <button className="notifications-open-link" type="button" onClick={() => openNotification(notification)}>เปิดรายการ</button>
          </div>
        </article>)}
        {loading && <p className="notifications-empty">กำลังโหลดรายการแจ้งเตือน...</p>}
        {!loading && !filteredNotifications.length && <p className="notifications-empty">{filter === 'all' ? 'ไม่มีรายการที่ต้องติดตาม' : 'ไม่มีรายการในตัวกรองนี้'}</p>}
      </section>
    </main>
  </div>;
}