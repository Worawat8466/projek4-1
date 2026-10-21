'use client';

import { useEffect, useMemo, useState } from 'react';

const menuItems = [
  ['Dashboard', '/dashboard'], ['หน้าร้าน', '/'], ['ลูกค้า', '/customers'], ['สัตว์เลี้ยง', '/pets'],
  ['สินค้า', '/products'], ['คลังสินค้า', '/inventory'], ['สั่งซื้อสินค้า', '/purchase-orders'],
  ['ผู้จัดจำหน่าย', '/suppliers'], ['สรุปยอดขาย', '/sales-reports'], ['จัดการพนักงาน', '/employees'], ['ตั้งค่า', '/settings']
];

const emptyOrderForm = { supplierCode: '', productCode: '', quantity: '1', packPrice: '' };
function localDateValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
const emptyReceiveForm = { quantity: '1', batch: '', expiry: '', received: localDateValue() };

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
}

function EyeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }).format(date);
}

function statusLabel(status) {
  return status === 'RECEIVED' ? 'รับครบแล้ว' : status === 'PARTIAL' ? 'รับบางส่วน' : status === 'CANCELLED' ? 'ยกเลิก' : 'รอรับสินค้า';
}

function normalizeOrder(order) {
  const firstItem = order.items?.[0] || {};
  return {
    ...order,
    productId: firstItem.productId,
    item: firstItem.item,
    quantity: firstItem.quantity,
    receivedQuantity: firstItem.receivedQuantity,
    packUnit: firstItem.packUnit,
    multiplier: firstItem.multiplier,
    packPrice: firstItem.packPrice
  };
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [orderForm, setOrderForm] = useState(emptyOrderForm);
  const [receiveForm, setReceiveForm] = useState(emptyReceiveForm);
  const [toast, setToast] = useState('');

  useEffect(() => {
    Promise.all([fetch('/api/purchase-orders'), fetch('/api/products'), fetch('/api/suppliers')])
      .then(async ([ordersResponse, productsResponse, suppliersResponse]) => {
        const [ordersResult, productsResult, suppliersResult] = await Promise.all([ordersResponse.json(), productsResponse.json(), suppliersResponse.json()]);
        if (!ordersResponse.ok || !productsResponse.ok || !suppliersResponse.ok) throw new Error('load_failed');
        setOrders(ordersResult.orders.map(normalizeOrder));
        setProducts(productsResult.products.filter((product) => product.tracksStock));
        setSuppliers(suppliersResult.suppliers.filter((supplier) => supplier.active));
        setLoadError(false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  const selectedProduct = products.find((product) => product.id === orderForm.productCode) || products[0];
  const quantity = Number(orderForm.quantity) || 0;
  const total = quantity * (Number(orderForm.packPrice) || 0);
  const filteredOrders = useMemo(() => {
    const value = query.trim().toLowerCase();
    return [...orders]
      .sort((first, second) => String(second.orderedAt).localeCompare(String(first.orderedAt)))
      .filter((order) => !value || [order.id, order.supplier, order.item, statusLabel(order.status)].some((field) => String(field || '').toLowerCase().includes(value)));
  }, [orders, query]);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  }

  function openCreateOrder() {
    const product = products[0];
    setOrderForm({
      ...emptyOrderForm,
      supplierCode: suppliers[0]?.id || '',
      productCode: product?.id || '',
      packPrice: product?.costPrice == null ? '' : String(product.costPrice * (product.multiplier || 1))
    });
    setModal({ type: 'create' });
  }

  async function createOrder(event) {
    event.preventDefault();
    try {
      const response = await fetch('/api/purchase-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...orderForm, packUnit: selectedProduct?.packUnit, quantity, packPrice: Number(orderForm.packPrice) })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'create_failed');
      setOrders((current) => [normalizeOrder(result.order), ...current]);
      setModal(null);
      notify(`สร้างใบสั่งซื้อ ${result.order.id} แล้ว`);
    } catch {
      notify('สร้างใบสั่งซื้อไม่สำเร็จ กรุณาตรวจข้อมูลและการเชื่อมต่อฐานข้อมูล');
    }
  }

  function openReceive(order) {
    const remaining = Math.max(0, order.quantity - (Number(order.receivedQuantity) || 0));
    setReceiveForm({ ...emptyReceiveForm, quantity: String(remaining || 1) });
    setModal({ type: 'receive', order });
  }

  async function receiveOrder(event) {
    event.preventDefault();
    try {
      const response = await fetch(`/api/purchase-orders/${modal.order.purchaseOrderId}/receive`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productCode: modal.order.productId,
          quantity: Number(receiveForm.quantity),
          lotNumber: receiveForm.batch,
          expiryDate: receiveForm.expiry,
          receivedAt: receiveForm.received
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'receive_failed');
      setOrders((current) => current.map((order) => order.purchaseOrderId === result.order.purchaseOrderId ? normalizeOrder(result.order) : order));
      setModal(null);
      notify(`รับเข้า ${result.baseQuantity} หน่วยเล็กแล้ว · ${statusLabel(result.order.status)}`);
    } catch (error) {
      notify(error.message === 'lot_expiry_mismatch' ? 'Lot นี้บันทึกด้วยวันหมดอายุอื่นแล้ว' : 'ตรวจรับไม่สำเร็จ กรุณาตรวจล็อต จำนวน และวันหมดอายุ');
    }
  }

  return <div className="purchase-page">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">TC</div><strong>Tle<span>Clinic</span></strong></div><nav>{menuItems.map(([label, href]) => <a className={label === 'สั่งซื้อสินค้า' ? 'active' : ''} href={href} key={label}>{label}</a>)}</nav></aside>
    <main className="purchase-main">
      <header className="purchase-header"><div><p>จัดซื้อและตรวจรับ</p><h1>สั่งซื้อสินค้า</h1></div><button className="add-customer-button" type="button" onClick={openCreateOrder} disabled={!products.length || !suppliers.length}><span>+</span> สร้างใบสั่งซื้อ</button></header>
      <label className="customer-search"><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาเลขที่ใบสั่งซื้อ หรือผู้จัดจำหน่าย..." /></label>
      <section className="purchase-table-wrap" aria-label="รายการใบสั่งซื้อ"><table className="purchase-table">
        <thead><tr><th>วันที่สั่งซื้อ</th><th>ผู้จัดจำหน่าย</th><th>รายการ</th><th>ยอดรวม</th><th>รับแล้ว</th><th>สถานะ</th><th>เลขที่ใบสั่งซื้อ</th><th>จัดการ</th></tr></thead>
        <tbody>{filteredOrders.map((order) => <tr key={order.id}>
          <td>{formatDate(order.orderedAt)}</td><td>{order.supplier}</td><td>{order.item}</td>
          <td className="mono">฿{Number(order.total).toLocaleString('th-TH')}</td>
          <td>{order.receivedQuantity || 0} / {order.quantity} {order.packUnit || ''}</td>
          <td><span className={`purchase-status ${order.status === 'RECEIVED' ? 'received' : order.status === 'CANCELLED' ? 'cancelled' : 'pending'}`}>{statusLabel(order.status)}</span></td>
          <td className="mono">{order.id}</td><td>{order.status !== 'RECEIVED' && order.status !== 'CANCELLED' ? <button className="receive-po-button" type="button" onClick={() => openReceive(order)}>ตรวจรับ</button> : <span className="purchase-complete-mark">ครบแล้ว</span>}</td>
        </tr>)}</tbody>
      </table>{!loading && filteredOrders.length === 0 && <div className="customer-empty">{loadError ? 'โหลดข้อมูลจากฐานข้อมูลไม่สำเร็จ' : 'ยังไม่มีใบสั่งซื้อในฐานข้อมูล'}</div>}</section>
    </main>

    {toast && <div className="toast" role="status"><b>OK</b>{toast}</div>}

    {modal?.type === 'create' && <div className="customer-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}><form className="customer-modal purchase-form-modal" onSubmit={createOrder}>
      <button type="button" className="modal-close" aria-label="ปิด" onClick={() => setModal(null)}>×</button><h2>สร้างใบสั่งซื้อ</h2>
      <label>ผู้จัดจำหน่าย<select required value={orderForm.supplierCode} onChange={(event) => setOrderForm({ ...orderForm, supplierCode: event.target.value })}>{suppliers.map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name}</option>)}</select></label>
      <div className="purchase-form-grid"><label>สินค้า<select required value={orderForm.productCode} onChange={(event) => { const product = products.find((item) => item.id === event.target.value); setOrderForm({ ...orderForm, productCode: event.target.value, packPrice: product?.costPrice == null ? '' : String(product.costPrice * (product.multiplier || 1)) }); }}>{products.map((product) => <option value={product.id} key={product.id}>{product.name} · {product.packUnit}</option>)}</select></label>
        <label>จำนวนสั่งซื้อ ({selectedProduct?.packUnit || 'หน่วย'})<input required type="number" min="1" step="1" value={orderForm.quantity} onChange={(event) => setOrderForm({ ...orderForm, quantity: event.target.value })} /></label>
        <label>ราคาต่อหน่วยสั่งซื้อ (บาท)<input required type="number" min="0" step="0.01" value={orderForm.packPrice} onChange={(event) => setOrderForm({ ...orderForm, packPrice: event.target.value })} /></label>
      </div>
      <div className="purchase-total"><span>คาดว่าจะรับเข้า</span><strong>{(quantity * (selectedProduct?.multiplier || 1)).toLocaleString('th-TH')} {selectedProduct?.baseUnit} · ฿{total.toLocaleString('th-TH')}</strong></div>
      <div className="purchase-actions"><button type="button" className="modal-cancel" onClick={() => setModal(null)}>ยกเลิก</button><button className="modal-submit">สร้างใบสั่งซื้อ</button></div>
    </form></div>}

    {modal?.type === 'receive' && <div className="customer-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}><form className="customer-modal purchase-form-modal" onSubmit={receiveOrder}>
      <button type="button" className="modal-close" aria-label="ปิด" onClick={() => setModal(null)}>×</button><h2>ตรวจรับสินค้า</h2>
      <p className="receive-po-summary">{modal.order.id} · {modal.order.item} · เหลือรับ {modal.order.quantity - modal.order.receivedQuantity} {modal.order.packUnit}</p>
      <div className="purchase-form-grid"><label>จำนวนที่รับ ({modal.order.packUnit})<input required type="number" min="1" max={modal.order.quantity - modal.order.receivedQuantity} step="1" value={receiveForm.quantity} onChange={(event) => setReceiveForm({ ...receiveForm, quantity: event.target.value })} /></label>
        <label>วันที่รับเข้า<input required type="date" value={receiveForm.received} onChange={(event) => setReceiveForm({ ...receiveForm, received: event.target.value })} /></label>
        <label>หมายเลขล็อต (Lot No.)<input required value={receiveForm.batch} onChange={(event) => setReceiveForm({ ...receiveForm, batch: event.target.value })} /></label>
        <label>วันหมดอายุ (EXP)<input required type="date" value={receiveForm.expiry} onChange={(event) => setReceiveForm({ ...receiveForm, expiry: event.target.value })} /></label>
      </div>
      <div className="inventory-multiplier-preview">= {(Number(receiveForm.quantity) * (modal.order.multiplier || 1)).toLocaleString('th-TH')} {products.find((product) => product.id === modal.order.productId)?.baseUnit || 'หน่วยเล็ก'} <span>ตามอัตรา 1 {modal.order.packUnit} = {modal.order.multiplier} หน่วยเล็ก</span></div>
      <div className="purchase-actions"><button type="button" className="modal-cancel" onClick={() => setModal(null)}>ยกเลิก</button><button className="modal-submit">บันทึกรับเข้า</button></div>
    </form></div>}
  </div>;
}
