'use client';

import { useEffect, useMemo, useState } from 'react';

const menuItems = [
  ['Dashboard', '/dashboard'], ['หน้าร้าน', '/'], ['ลูกค้า', '/customers'], ['สัตว์เลี้ยง', '/pets'],
  ['สินค้า', '/products'], ['คลังสินค้า', '/inventory'], ['สั่งซื้อสินค้า', '/purchase-orders'],
  ['ผู้จัดจำหน่าย', '/suppliers'], ['สรุปยอดขาย', '/sales-reports'], ['จัดการพนักงาน', '/employees'], ['ตั้งค่า', '/settings']
];

const periodOptions = [
  ['today', 'วันนี้'], ['7d', '7 วัน'], ['month', 'เดือนนี้'], ['custom', 'กำหนดเอง']
];

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMoney(amount) {
  return `฿${Math.round(amount || 0).toLocaleString('th-TH')}`;
}

function getNetSales(sale) {
  if (Number.isFinite(sale.netSales)) return sale.netSales;
  return (Number(sale.total) || 0) - (Number(sale.tax) || 0);
}

function formatDate(date, options = { day: 'numeric', month: 'short', year: '2-digit' }) {
  return new Intl.DateTimeFormat('th-TH', options).format(date);
}

function getBucketDate(date, mode) {
  const bucketDate = new Date(date);
  if (mode === 'week') {
    const daysSinceMonday = (bucketDate.getDay() + 6) % 7;
    bucketDate.setDate(bucketDate.getDate() - daysSinceMonday);
  } else if (mode === 'month') {
    bucketDate.setDate(1);
  }
  bucketDate.setHours(0, 0, 0, 0);
  return bucketDate;
}

function getBucketKey(date, mode) {
  const bucketDate = getBucketDate(date, mode);
  return mode === 'month'
    ? `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, '0')}`
    : localDateKey(bucketDate);
}

function buildTrend(sales, from, to) {
  const firstDay = new Date(`${from}T00:00:00`);
  const lastDay = new Date(`${to}T00:00:00`);
  if (Number.isNaN(firstDay.getTime()) || Number.isNaN(lastDay.getTime()) || firstDay > lastDay) return [];

  const spanDays = Math.floor((lastDay - firstDay) / 86400000) + 1;
  const mode = spanDays <= 14 ? 'day' : spanDays <= 62 ? 'week' : 'month';
  const buckets = new Map();

  for (const cursor = new Date(firstDay); cursor <= lastDay; cursor.setDate(cursor.getDate() + 1)) {
    const bucketDate = getBucketDate(cursor, mode);
    const key = getBucketKey(cursor, mode);
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        date: bucketDate,
        label: formatDate(bucketDate, mode === 'day' ? { day: 'numeric' } : { day: 'numeric', month: 'short' }),
        total: 0
      });
    }
  }

  for (const sale of sales) {
    const soldAt = new Date(sale.soldAt);
    if (Number.isNaN(soldAt.getTime())) continue;
    const bucket = buckets.get(getBucketKey(soldAt, mode));
    if (bucket) bucket.total += getNetSales(sale);
  }

  return [...buckets.values()];
}

export default function SalesReportsPage() {
  const [sales, setSales] = useState([]);
  const [dataError, setDataError] = useState('');
  const [period, setPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState(() => localDateKey(new Date()));
  const [customTo, setCustomTo] = useState(() => localDateKey(new Date()));

  useEffect(() => {
    let active = true;
    fetch('/api/sales')
      .then((response) => {
        if (!response.ok) throw new Error('database_unavailable');
        return response.json();
      })
      .then((data) => { if (active) setSales(data.sales); })
      .catch(() => { if (active) setDataError('โหลดรายงานจากฐานข้อมูลไม่สำเร็จ'); });
    return () => { active = false; };
  }, []);

  const dateRange = useMemo(() => {
    const today = new Date();
    const to = localDateKey(today);
    if (period === 'today') return { from: to, to };
    if (period === '7d') {
      const firstDay = new Date(today);
      firstDay.setDate(firstDay.getDate() - 6);
      return { from: localDateKey(firstDay), to };
    }
    if (period === 'month') return { from: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`, to };
    return { from: customFrom, to: customTo };
  }, [period, customFrom, customTo]);
  const rangeLabel = useMemo(() => {
    if (!dateRange.from || !dateRange.to || dateRange.from > dateRange.to) return 'เลือกวันที่ให้ครบ';
    const from = new Date(`${dateRange.from}T00:00:00`);
    const to = new Date(`${dateRange.to}T00:00:00`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 'เลือกวันที่ให้ครบ';
    return `${formatDate(from)} - ${formatDate(to)}`;
  }, [dateRange]);

  const filteredSales = useMemo(() => sales.filter((sale) => {
    const soldAt = new Date(sale.soldAt);
    if (Number.isNaN(soldAt.getTime())) return false;
    const day = localDateKey(soldAt);
    return day >= dateRange.from && day <= dateRange.to;
  }), [sales, dateRange]);

  const summary = useMemo(() => {
    const revenue = filteredSales.reduce((total, sale) => total + getNetSales(sale), 0);
    const productItems = filteredSales.flatMap((sale) => (Array.isArray(sale.items) ? sale.items : []))
      .filter((item) => item.type === 'สินค้า');
    const hasCompleteCost = productItems.every((item) => Number.isFinite(item.unitCost));
    const cost = productItems.reduce((total, item) => total + (Number(item.unitCost) || 0) * (Number(item.quantity) || 0), 0);
    return {
      revenue,
      bills: filteredSales.length,
      average: filteredSales.length ? revenue / filteredSales.length : 0,
      grossProfit: !filteredSales.length ? 0 : hasCompleteCost ? revenue - cost : null
    };
  }, [filteredSales]);

  const trend = useMemo(() => buildTrend(filteredSales, dateRange.from, dateRange.to), [filteredSales, dateRange]);
  const peak = Math.max(...trend.map((bucket) => bucket.total), 0);

  const paymentBreakdown = useMemo(() => {
    const paymentTotals = new Map();
    for (const sale of filteredSales) {
      const method = sale.paymentMethod || 'ไม่ระบุ';
      const current = paymentTotals.get(method) || { method, amount: 0, bills: 0 };
      current.amount += Number(sale.total) || 0;
      current.bills += 1;
      paymentTotals.set(method, current);
    }
    return [...paymentTotals.values()].sort((first, second) => second.amount - first.amount);
  }, [filteredSales]);

  const topProducts = useMemo(() => {
    const products = new Map();
    for (const sale of filteredSales) {
      for (const item of Array.isArray(sale.items) ? sale.items : []) {
        if (item.type !== 'สินค้า') continue;
        const product = products.get(item.productId) || { id: item.productId, name: item.name, quantity: 0, total: 0 };
        product.quantity += Number(item.quantity) || 0;
        product.total += Number(item.lineTotal) || 0;
        products.set(item.productId, product);
      }
    }
    return [...products.values()].sort((first, second) => second.quantity - first.quantity).slice(0, 5);
  }, [filteredSales]);

  const recentSales = useMemo(() => [...filteredSales]
    .sort((first, second) => new Date(second.soldAt) - new Date(first.soldAt))
    .slice(0, 8), [filteredSales]);

  return <div className="sales-reports-page">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">TC</div><strong>Tle<span>Clinic</span></strong></div>
      <nav>{menuItems.map(([label, href]) => <a className={label === 'สรุปยอดขาย' ? 'active' : ''} href={href} key={label}>{label}</a>)}</nav>
    </aside>

    <main className="sales-report-main">
      <header className="sales-report-header">
        <div><p>รายงานและวิเคราะห์</p><h1>สรุปยอดขาย</h1></div>
        <a className="sales-pos-link" href="/">ไปหน้าขาย <span aria-hidden="true">↗</span></a>
      </header>

      <section className="sales-filter-bar" aria-label="ตัวกรองช่วงเวลา">
        <div className="sales-period-tabs" role="group" aria-label="เลือกช่วงเวลา">
          {periodOptions.map(([value, label]) => <button type="button" className={period === value ? 'selected' : ''} onClick={() => setPeriod(value)} key={value}>{label}</button>)}
        </div>
        {period === 'custom' && <div className="sales-date-inputs">
          <label>ตั้งแต่<input type="date" value={customFrom} max={customTo} onChange={(event) => setCustomFrom(event.target.value)} /></label>
          <span aria-hidden="true">ถึง</span>
          <label>ถึง<input type="date" value={customTo} min={customFrom} onChange={(event) => setCustomTo(event.target.value)} /></label>
        </div>}
        <span className="sales-range-label">{rangeLabel}</span>
      </section>

      <section className="sales-kpis" aria-label="ตัวเลขสรุปยอดขาย">
        <article className="sales-kpi sales-kpi-primary"><span>ยอดขายสุทธิ</span><strong>{formatMoney(summary.revenue)}</strong><small>หลังหักส่วนลด</small></article>
        <article className="sales-kpi"><span>จำนวนบิล</span><strong>{summary.bills.toLocaleString('th-TH')} <small>บิล</small></strong><small>เฉพาะรายการที่ชำระแล้ว</small></article>
        <article className="sales-kpi"><span>ยอดเฉลี่ยต่อบิล</span><strong>{formatMoney(summary.average)}</strong><small>ยอดสุทธิ ÷ จำนวนบิล</small></article>
        <article className="sales-kpi"><span>กำไรขั้นต้น</span><strong>{summary.grossProfit === null ? 'รอข้อมูลต้นทุน' : formatMoney(summary.grossProfit)}</strong><small>{summary.grossProfit === null ? 'เพิ่มราคาทุนสินค้าเพื่อคำนวณ' : 'ยอดขายสุทธิ - ต้นทุนสินค้า'}</small></article>
      </section>

      <section className="sales-analysis-grid">
        <article className="sales-panel sales-trend-panel">
          <div className="sales-panel-heading"><div><h2>แนวโน้มยอดขาย</h2><p>ยอดสุทธิในช่วงเวลาที่เลือก</p></div><strong>{formatMoney(summary.revenue)}</strong></div>
          {trend.length > 0 ? <div className="sales-chart" style={{ '--chart-columns': trend.length }}>
            <div className="sales-chart-grid"><i /><i /><i /><i /></div>
            <div className="sales-chart-bars">{trend.map((bucket) => <div className="sales-chart-column" key={bucket.key} title={`${formatDate(bucket.date)}: ${formatMoney(bucket.total)}`}>
              <div className="sales-chart-bar-wrap"><span className="sales-chart-bar" style={{ height: `${peak ? Math.max(4, (bucket.total / peak) * 100) : 4}%` }} /></div>
              <small>{bucket.label}</small>
            </div>)}</div>
          </div> : <div className="sales-empty-chart">เลือกช่วงวันที่ที่ถูกต้องเพื่อดูแนวโน้ม</div>}
        </article>

        <article className="sales-panel sales-payment-panel">
          <div className="sales-panel-heading"><div><h2>ช่องทางชำระเงิน</h2><p>ยอดรับชำระรวมภาษี</p></div></div>
          {paymentBreakdown.length > 0 ? <div className="sales-payment-list">{paymentBreakdown.map((payment) => <div className="sales-payment-row" key={payment.method}>
            <span className={`payment-dot ${payment.method === 'เงินสด' ? 'cash' : 'promptpay'}`} />
            <div><b>{payment.method}</b><small>{payment.bills} บิล</small></div>
            <strong>{formatMoney(payment.amount)}</strong>
          </div>)}</div> : <div className="sales-empty-small">ยังไม่มีรายการชำระเงินในช่วงนี้</div>}
        </article>
      </section>

      <section className="sales-detail-grid">
        <article className="sales-panel sales-products-panel">
          <div className="sales-panel-heading"><div><h2>สินค้าขายดี</h2><p>เรียงตามจำนวนที่ขาย</p></div></div>
          {topProducts.length > 0 ? <div className="sales-products-list">{topProducts.map((product, index) => <div className="sales-product-row" key={product.id || product.name}>
            <span className="sales-product-rank">{String(index + 1).padStart(2, '0')}</span><div><b>{product.name}</b><small>{product.quantity} รายการ</small></div><strong>{formatMoney(product.total)}</strong>
          </div>)}</div> : <div className="sales-empty-small">ยังไม่มีข้อมูลสินค้าในช่วงนี้</div>}
        </article>

        <article className="sales-panel sales-recent-panel">
          <div className="sales-panel-heading"><div><h2>รายการขายล่าสุด</h2><p>แสดงสูงสุด 8 บิล</p></div></div>
          {recentSales.length > 0 ? <div className="sales-table-wrap"><table className="sales-table">
            <thead><tr><th>เลขที่บิล / เวลา</th><th>ลูกค้า</th><th>ชำระโดย</th><th>ยอดชำระ</th></tr></thead>
            <tbody>{recentSales.map((sale) => <tr key={sale.id}>
              <td><b>{sale.id}</b><small>{formatDate(new Date(sale.soldAt), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></td>
              <td>{sale.customerName || 'ลูกค้าทั่วไป'}</td><td>{sale.paymentMethod || '-'}</td><td className="sales-table-total">{formatMoney(sale.total)}</td>
            </tr>)}</tbody>
          </table></div> : <div className="sales-empty-small">ยังไม่มีบิลขายในช่วงนี้ เมื่อปิดบิลจากหน้าร้าน รายการจะแสดงที่นี่</div>}
        </article>
      </section>
      {dataError && <p className="sales-report-note" role="alert">{dataError}</p>}
      <p className="sales-report-note">รายงานจาก Oracle Database · ต้นทุนอ้างอิงราคาทุนของล็อตที่ขาย</p>
    </main>
  </div>;
}