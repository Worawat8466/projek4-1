'use client';

import { useEffect, useMemo, useState } from 'react';
import { defaultSettings, readSettings } from '../../src/appSettings.js';
import { getLotStatus, readInventory } from '../../src/inventoryStore.js';
import { readSales } from '../../src/salesLedger.js';

const menuItems = [
  ['Dashboard', '/dashboard'], ['หน้าร้าน', '/'], ['ลูกค้า', '/customers'], ['สัตว์เลี้ยง', '/pets'],
  ['สินค้า', '/products'], ['คลังสินค้า', '/inventory'], ['สั่งซื้อสินค้า', '/purchase-orders'],
  ['ผู้จัดจำหน่าย', '/suppliers'], ['สรุปยอดขาย', '/sales-reports'], ['จัดการพนักงาน', '/employees'], ['ตั้งค่า', '/settings']
];

const periods = [['today', 'วันนี้'], ['7d', '7 วัน'], ['month', 'เดือนนี้']];

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function netSales(sale) {
  if (Number.isFinite(sale.netSales)) return sale.netSales;
  return (Number(sale.total) || 0) - (Number(sale.tax) || 0);
}

function money(value) {
  return `฿${Math.round(value || 0).toLocaleString('th-TH')}`;
}

function dateLabel(date, options = { day: 'numeric', month: 'short' }) {
  return new Intl.DateTimeFormat('th-TH', options).format(date);
}

function getRange(period) {
  const today = new Date();
  const to = dateKey(today);
  if (period === 'today') return { from: to, to };
  if (period === '7d') {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from: dateKey(from), to };
  }
  return { from: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`, to };
}

function buildTrend(sales, from, to) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const buckets = new Map();
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const key = dateKey(cursor);
    buckets.set(key, { key, label: dateLabel(cursor, { day: 'numeric' }), date: new Date(cursor), total: 0 });
  }
  for (const sale of sales) {
    const soldAt = new Date(sale.soldAt);
    if (Number.isNaN(soldAt.getTime())) continue;
    const bucket = buckets.get(dateKey(soldAt));
    if (bucket) bucket.total += netSales(sale);
  }
  return [...buckets.values()];
}

function paymentTotals(sales) {
  const totals = new Map();
  for (const sale of sales) {
    const method = sale.paymentMethod || 'ไม่ระบุ';
    totals.set(method, (totals.get(method) || 0) + (Number(sale.total) || 0));
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

function topProducts(sales) {
  const products = new Map();
  for (const sale of sales) {
    for (const item of Array.isArray(sale.items) ? sale.items : []) {
      if (item.type !== 'สินค้า') continue;
      const product = products.get(item.productId) || { id: item.productId, name: item.name, quantity: 0, total: 0 };
      product.quantity += Number(item.quantity) || 0;
      product.total += Number(item.lineTotal) || 0;
      products.set(item.productId, product);
    }
  }
  return [...products.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
}

export default function DashboardPage() {
  const [period, setPeriod] = useState('7d');
  const [sales, setSales] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);

  useEffect(() => {
    function refreshData() {
      setSales(readSales());
      setInventory(readInventory());
      setSettings(readSettings());
    }
    refreshData();
    window.addEventListener('clinic-settings-updated', refreshData);
    window.addEventListener('clinic-inventory-updated', refreshData);
    window.addEventListener('storage', refreshData);
    return () => {
      window.removeEventListener('clinic-settings-updated', refreshData);
      window.removeEventListener('clinic-inventory-updated', refreshData);
      window.removeEventListener('storage', refreshData);
    };
  }, []);

  const range = useMemo(() => getRange(period), [period]);
  const visibleSales = useMemo(() => sales.filter((sale) => {
    const soldAt = new Date(sale.soldAt);
    if (Number.isNaN(soldAt.getTime())) return false;
    const day = dateKey(soldAt);
    return day >= range.from && day <= range.to;
  }), [sales, range]);

  const revenue = visibleSales.reduce((total, sale) => total + netSales(sale), 0);
  const average = visibleSales.length ? revenue / visibleSales.length : 0;
  const trend = useMemo(() => buildTrend(visibleSales, range.from, range.to), [visibleSales, range]);
  const peak = Math.max(...trend.map((point) => point.total), 0);
  const alerts = useMemo(() => inventory
    .map((item) => ({ ...item, alertStatus: getLotStatus(item, settings) }))
    .filter((item) => item.alertStatus !== 'ปกติ')
    .sort((a, b) => {
      const priority = { หมดอายุ: 0, 'ใกล้หมดอายุ': 1, 'สต็อกต่ำ': 2 };
      return priority[a.alertStatus] - priority[b.alertStatus];
    }), [inventory, settings]);
  const alertCounts = useMemo(() => alerts.reduce((counts, item) => {
    counts[item.alertStatus] = (counts[item.alertStatus] || 0) + 1;
    return counts;
  }, {}), [alerts]);
  const products = useMemo(() => topProducts(visibleSales), [visibleSales]);
  const payments = useMemo(() => paymentTotals(visibleSales), [visibleSales]);
  const recentSales = useMemo(() => [...visibleSales]
    .sort((a, b) => new Date(b.soldAt) - new Date(a.soldAt))
    .slice(0, 5), [visibleSales]);

  return <div className="dashboard-page">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">TC</div><strong>Tle<span>Clinic</span></strong></div>
      <nav>{menuItems.map(([label, href]) => <a className={label === 'Dashboard' ? 'active' : ''} href={href} key={label}>{label}</a>)}</nav>
    </aside>

    <main className="dashboard-main">
      <header className="dashboard-header">
        <div><p>ภาพรวมคลินิก</p><h1>Dashboard</h1><span>{dateLabel(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
        <a href="/" className="dashboard-pos-link">เปิดหน้าขาย <span aria-hidden="true">↗</span></a>
      </header>

      <section className="dashboard-periods" aria-label="ช่วงเวลารายงาน">
        <div className="dashboard-period-tabs" role="group" aria-label="เลือกช่วงเวลา">
          {periods.map(([value, label]) => <button type="button" className={period === value ? 'selected' : ''} onClick={() => setPeriod(value)} key={value}>{label}</button>)}
        </div>
        <span>{dateLabel(new Date(`${range.from}T00:00:00`))} – {dateLabel(new Date(`${range.to}T00:00:00`))}</span>
      </section>

      <section className="dashboard-kpis" aria-label="สรุปภาพรวม">
        <article className="dashboard-kpi dashboard-kpi-highlight"><span>ยอดขายสุทธิ</span><strong>{money(revenue)}</strong><small>หลังหักส่วนลด · ไม่รวม VAT</small></article>
        <article className="dashboard-kpi"><span>บิลที่ชำระแล้ว</span><strong>{visibleSales.length.toLocaleString('th-TH')} <small>บิล</small></strong><small>ในช่วงเวลาที่เลือก</small></article>
        <article className="dashboard-kpi"><span>ยอดเฉลี่ยต่อบิล</span><strong>{money(average)}</strong><small>ยอดขายสุทธิ ÷ จำนวนบิล</small></article>
        <article className={`dashboard-kpi ${alerts.length ? 'dashboard-kpi-alert' : ''}`}><span>รายการคลังที่ต้องดูแล</span><strong>{alerts.length.toLocaleString('th-TH')} <small>ล็อต</small></strong><small>หมดอายุ {alertCounts['หมดอายุ'] || 0} · ใกล้หมด {alertCounts['ใกล้หมดอายุ'] || 0} · สต็อกต่ำ {alertCounts['สต็อกต่ำ'] || 0}</small></article>
      </section>

      <section className="dashboard-primary-grid">
        <article className="dashboard-panel dashboard-trend-panel">
          <div className="dashboard-panel-heading"><div><h2>แนวโน้มยอดขาย</h2><p>ยอดขายสุทธิรายวัน</p></div><strong>{money(revenue)}</strong></div>
          {trend.length > 0 && visibleSales.length > 0 ? <div className="dashboard-chart" style={{ '--chart-columns': trend.length }}>
            <div className="dashboard-chart-grid"><i /><i /><i /><i /></div>
            <div className="dashboard-chart-bars">{trend.map((point) => <div className="dashboard-chart-column" key={point.key} title={`${dateLabel(point.date)}: ${money(point.total)}`}>
              <div className="dashboard-chart-bar-wrap"><span className="dashboard-chart-bar" style={{ height: `${peak ? Math.max(4, point.total / peak * 100) : 4}%` }} /></div>
              <small>{point.label}</small>
            </div>)}</div>
          </div> : <div className="dashboard-empty dashboard-chart-empty"><p>ยังไม่มีรายการขายในช่วงนี้</p><a href="/">เปิดหน้าขาย</a></div>}
        </article>

        <article className="dashboard-panel dashboard-alert-panel">
          <div className="dashboard-panel-heading"><div><h2>ติดตามคลังสินค้า</h2><p>ล็อตที่ควรตรวจสอบก่อน</p></div><a href="/inventory">ดูคลัง <span aria-hidden="true">↗</span></a></div>
          {alerts.length ? <div className="dashboard-alert-list">{alerts.slice(0, 5).map((item) => <a href="/inventory" className="dashboard-alert-row" key={`${item.id}-${item.batch}`}>
            <span className={`dashboard-alert-mark ${item.alertStatus === 'หมดอายุ' ? 'expired' : item.alertStatus === 'ใกล้หมดอายุ' ? 'expiring' : 'low'}`} />
            <div><b>{item.name}</b><small>ล็อต {item.batch} · เหลือ {item.units} หน่วย</small></div>
            <span className={`dashboard-alert-status ${item.alertStatus === 'หมดอายุ' ? 'expired' : item.alertStatus === 'ใกล้หมดอายุ' ? 'expiring' : 'low'}`}>{item.alertStatus}</span>
          </a>)}</div> : <div className="dashboard-empty dashboard-alert-empty">ไม่มีรายการคลังที่ต้องแจ้งเตือน</div>}
        </article>
      </section>

      <section className="dashboard-secondary-grid">
        <article className="dashboard-panel dashboard-products-panel">
          <div className="dashboard-panel-heading"><div><h2>สินค้าขายดี</h2><p>เรียงตามจำนวนที่ขาย</p></div><a href="/sales-reports">รายงาน <span aria-hidden="true">↗</span></a></div>
          {products.length ? <div className="dashboard-product-list">{products.slice(0, 4).map((product, index) => <div className="dashboard-product-row" key={product.id || product.name}>
            <span>{String(index + 1).padStart(2, '0')}</span><div><b>{product.name}</b><small>{product.quantity} ชิ้น</small></div><strong>{money(product.total)}</strong>
          </div>)}</div> : <div className="dashboard-empty">ยังไม่มีข้อมูลสินค้าในช่วงนี้</div>}
          {payments.length > 0 && <div className="dashboard-payment-summary"><span>ช่องทางรับชำระ</span>{payments.map(([method, amount]) => <div key={method}><b>{method}</b><strong>{money(amount)}</strong></div>)}</div>}
        </article>

        <article className="dashboard-panel dashboard-recent-panel">
          <div className="dashboard-panel-heading"><div><h2>รายการขายล่าสุด</h2><p>แสดงสูงสุด 5 บิล</p></div><a href="/sales-reports">ดูทั้งหมด <span aria-hidden="true">↗</span></a></div>
          {recentSales.length ? <div className="dashboard-recent-list">{recentSales.map((sale) => <div className="dashboard-recent-row" key={sale.id}>
            <div><b>{sale.id}</b><small>{sale.customerName || 'ลูกค้าทั่วไป'} · {dateLabel(new Date(sale.soldAt), { hour: '2-digit', minute: '2-digit' })}</small></div>
            <strong>{money(sale.total)}</strong>
          </div>)}</div> : <div className="dashboard-empty dashboard-recent-empty">ยังไม่มีบิลขายที่บันทึกในช่วงนี้<a href="/">ไปหน้าขาย</a></div>}
        </article>
      </section>

      <section className="dashboard-quick-links" aria-label="ทางลัด">
        <a href="/">เปิดหน้าขาย <span aria-hidden="true">↗</span></a>
        <a href="/inventory">รับสินค้าเข้า <span aria-hidden="true">↗</span></a>
        <a href="/purchase-orders">สร้างใบสั่งซื้อ <span aria-hidden="true">↗</span></a>
        <a href="/employees">จัดการพนักงาน <span aria-hidden="true">↗</span></a>
      </section>
    </main>
  </div>;
}