'use client';

import { useEffect, useMemo, useState } from 'react';
import { defaultInventory, readInventory } from '../../src/inventoryStore.js';
import { defaultProducts, readProducts } from '../../src/productStore.js';
import { commitPurchaseOrderReceipt, defaultPurchaseOrders, readPurchaseOrders, savePurchaseOrders } from '../../src/purchaseOrderStore.js';

const menuItems = [
  ['Dashboard', '/dashboard'], ['หน้าร้าน', '/'], ['ลูกค้า', '/customers'], ['สัตว์เลี้ยง', '/pets'],
  ['สินค้า', '/products'], ['คลังสินค้า', '/inventory'], ['สั่งซื้อสินค้า', '/purchase-orders'],
  ['ผู้จัดจำหน่าย', '/suppliers'], ['สรุปยอดขาย', '/sales-reports'], ['จัดการพนักงาน', '/employees'], ['ตั้งค่า', '/settings']
];

const supplierOptions = ['บจก. เพ็ทแคร์ (ประเทศไทย) จำกัด', 'บริษัท โรยัล คานิน (Royal Canin)', 'บริษัท สัตวแพทย์ไทย จำกัด'];
const emptyOrderForm = { supplier: supplierOptions[0], productId: '', quantity: '1', packPrice: '' };

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
}

function EyeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
}

function statusLabel(status) {
  return status === 'RECEIVED' ? 'รับครบแล้ว' : status === 'PARTIAL' ? 'รับบางส่วน' : status === 'CANCELLED' ? 'ยกเลิก' : 'รอรับสินค้า';
}

function displayDate(value) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }).format(date);
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState(defaultPurchaseOrders);
  const [products, setProducts] = useState(defaultProducts);
  const [inventory, setInventory] = useState(defaultInventory);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [orderForm, setOrderForm] = useState(emptyOrderForm);
  const [receiveForm, setReceiveForm] = useState({ quantity: '1', batch: '', expiry: '', received: new Date().toISOString().slice(0, 10) });
  const [toast, setToast] = useState('');

  useEffect(() => {
    setOrders(readPurchaseOrders());
    setProducts(readProducts());
    setInventory(readInventory());
    setReady(true);
    function refreshProducts() { setProducts(readProducts()); }
    function refreshInventory() { setInventory(readInventory()); }
    window.addEventListener('clinic-products-updated', refreshProducts);
    window.addEventListener('clinic-inventory-updated', refreshInventory);
    window.addEventListener('storage', refreshInventory);
    return () => {
      window.removeEventListener('clinic-products-updated', refreshProducts);
      window.removeEventListener('clinic-inventory-updated', refreshInventory);
      window.removeEventListener('storage', refreshInventory);
    };
  }, []);

  useEffect(() => {
    if (ready) savePurchaseOrders(orders);
  }, [orders, ready]);

  const stockedProducts = useMemo(() => products.filter((product) => product.tracksStock), [products]);
  const selectedProduct = stockedProducts.find((product) => product.id === orderForm.productId) || stockedProducts[0];
  const packQuantity = Number(orderForm.quantity) || 0;
  const multiplier = Number(selectedProduct?.multiplier) || 1;
  const receivedBaseQuantity = packQuantity * multiplier;
  const packPrice = Number(orderForm.packPrice) || 0;
  const total = packPrice * packQuantity;

  const filteredOrders = useMemo(() => {
    const value = query.trim().toLowerCase();
    return [...orders]
      .sort((first, second) => String(second.orderedAt).localeCompare(String(first.orderedAt)))
      .filter((order) => !value || [order.id, order.supplier, order.item, statusLabel(order.status)].some((field) => String(field).toLowerCase().includes(value)));
  }, [orders, query]);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  }

  function openCreateOrder() {
    const firstProduct = stockedProducts[0];
    setOrderForm({ ...emptyOrderForm, productId: firstProduct?.id || '', packPrice: firstProduct?.costPrice == null ? '' : String(firstProduct.costPrice * (firstProduct.multiplier || 1)) });
    setModal({ type: 'create' });
  }

  function createOrder(event) {
    event.preventDefault();
    if (!selectedProduct || packQuantity < 1 || !Number.isFinite(packPrice) || packPrice < 0) {
      notify('กรุณาเลือกสินค้า ระบุจำนวนและราคาต่อหน่วยสั่งซื้อ');
      return;
    }
    const now = new Date();
    const orderNumber = `PO-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`;
    const order = {
      id: orderNumber,
      orderedAt: now.toISOString().slice(0, 10),
      supplier: orderForm.supplier,
      productId: selectedProduct.id,
      item: selectedProduct.name,
      quantity: packQuantity,
      receivedQuantity: 0,
      packUnit: selectedProduct.packUnit,
      multiplier,
      packPrice,
      price: packPrice,
      total,
      status: 'ORDERED'
    };
    setOrders((current) => [order, ...current]);
    setModal(null);
    notify(`สร้างใบสั่งซื้อ ${orderNumber} แล้ว`);
  }

  function openReceive(order) {
    const remaining = Math.max(0, order.quantity - (Number(order.receivedQuantity) || 0));
    setReceiveForm({ quantity: String(remaining || 1), batch: '', expiry: '', received: new Date().toISOString().slice(0, 10) });
    setModal({ type: 'receive', order });
  }

  function receiveOrder(event) {
    event.preventDefault();
    const order = modal.order;
    const quantity = Number(receiveForm.quantity);
    const remaining = order.quantity - (Number(order.receivedQuantity) || 0);
    const product = products.find((item) => item.id === order.productId);
    if (!product || !quantity || quantity < 1 || quantity > remaining || !receiveForm.batch.trim() || !receiveForm.expiry) {
      notify('กรุณาระบุจำนวนที่ยังขาด ล็อต และวันหมดอายุให้ถูกต้อง');
      return;
    }

    const baseQuantity = quantity * (Number(order.multiplier) || Number(product.multiplier) || 1);
    const matchingLot = inventory.find((lot) => (lot.productId || lot.id) === product.id && lot.batch.trim().toLowerCase() === receiveForm.batch.trim().toLowerCase());
    const nextLot = matchingLot
      ? { ...matchingLot, units: Number(matchingLot.units) + baseQuantity, packs: Number(matchingLot.packs || 0) + quantity }
      : {
        id: product.id, productId: product.id, name: product.name, batch: receiveForm.batch.trim(),
        expiry: receiveForm.expiry, received: receiveForm.received, units: baseQuantity, packs: quantity,
        baseUnit: product.baseUnit, packUnit: order.packUnit || product.packUnit,
        multiplier: Number(order.multiplier) || Number(product.multiplier) || 1,
        unitCostBase: Number.isFinite(Number(order.packPrice)) ? Number(order.packPrice) / (Number(order.multiplier) || Number(product.multiplier) || 1) : null,
        status: 'ปกติ'
      };
    const nextInventory = matchingLot
      ? inventory.map((lot) => lot.productId === matchingLot.productId && lot.batch === matchingLot.batch ? nextLot : lot)
      : [...inventory, nextLot];
    const receivedQuantity = (Number(order.receivedQuantity) || 0) + quantity;
    const nextOrders = orders.map((item) => item.id === order.id
      ? { ...item, receivedQuantity, status: receivedQuantity >= item.quantity ? 'RECEIVED' : 'PARTIAL' }
      : item);
    const committed = commitPurchaseOrderReceipt(nextOrders, nextInventory, {
      productId: product.id,
      batch: receiveForm.batch.trim(),
      movementType: 'RECEIVE',
      packQuantity: quantity,
      packUnit: order.packUnit || product.packUnit,
      multiplier: Number(order.multiplier) || Number(product.multiplier) || 1,
      baseQuantity,
      referenceType: 'PURCHASE_ORDER',
      referenceId: order.id,
      reason: 'รับสินค้าตามใบสั่งซื้อ'
    });
    if (!committed) {
      notify('บันทึกรับสินค้าไม่สำเร็จ');
      return;
    }
    setOrders(nextOrders);
    setInventory(nextInventory);
    setModal(null);
    notify(`รับเข้า ${baseQuantity} ${product.baseUnit} แล้ว · ${receivedQuantity >= order.quantity ? 'รับครบแล้ว' : 'รับบางส่วน'}`);
  }

  return <div className="purchase-page">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">TC</div><strong>Tle<span>Clinic</span></strong></div>
      <nav>{menuItems.map(([label, href]) => <a className={label === 'สั่งซื้อสินค้า' ? 'active' : ''} href={href} key={label}>{label}</a>)}</nav>
    </aside>

    <main className="purchase-main">
      <header className="purchase-header"><div><p>จัดซื้อและตรวจรับ</p><h1>สั่งซื้อสินค้า</h1></div><button className="add-customer-button" type="button" onClick={openCreateOrder}><span>+</span> สร้างใบสั่งซื้อ</button></header>
      <label className="customer-search"><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาเลขที่ใบสั่งซื้อ หรือผู้จัดจำหน่าย..." /></label>
      <section className="purchase-table-wrap" aria-label="รายการใบสั่งซื้อ">
        <table className="purchase-table">
          <thead><tr><th>วันที่สั่งซื้อ</th><th>ผู้จัดจำหน่าย</th><th>รายการ</th><th>ยอดรวม</th><th>รับแล้ว</th><th>สถานะ</th><th>เลขที่ใบสั่งซื้อ</th><th>จัดการ</th></tr></thead>
          <tbody>{filteredOrders.map((order) => <tr key={order.id}>
            <td>{displayDate(order.orderedAt)}</td><td>{order.supplier}</td><td>{order.item}</td>
            <td className="mono">฿{Number(order.total).toLocaleString('th-TH')}</td>
            <td>{order.receivedQuantity || 0} / {order.quantity} {order.packUnit || ''}</td>
            <td><span className={`purchase-status ${order.status === 'RECEIVED' ? 'received' : order.status === 'PARTIAL' ? 'pending' : order.status === 'CANCELLED' ? 'cancelled' : 'pending'}`}>{statusLabel(order.status)}</span></td>
            <td className="mono">{order.id}</td>
            <td>{order.status !== 'RECEIVED' && order.status !== 'CANCELLED' ? <button className="receive-po-button" type="button" onClick={() => openReceive(order)}>ตรวจรับ</button> : <span className="purchase-complete-mark">ครบแล้ว</span>}</td>
          </tr>)}</tbody>
        </table>
        {filteredOrders.length === 0 && <div className="customer-empty">ไม่พบใบสั่งซื้อ</div>}
      </section>
    </main>

    {toast && <div className="toast" role="status"><b>OK</b>{toast}</div>}

    {modal?.type === 'create' && <div className="customer-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}>
      <form className="customer-modal purchase-form-modal" onSubmit={createOrder}>
        <button type="button" className="modal-close" aria-label="ปิด" onClick={() => setModal(null)}>×</button>
        <h2>สร้างใบสั่งซื้อ</h2>
        <label>ผู้จัดจำหน่าย<select value={orderForm.supplier} onChange={(event) => setOrderForm({ ...orderForm, supplier: event.target.value })}>{supplierOptions.map((supplier) => <option key={supplier}>{supplier}</option>)}</select></label>
        <div className="purchase-form-grid">
          <label>สินค้า<select required value={orderForm.productId} onChange={(event) => { const product = stockedProducts.find((item) => item.id === event.target.value); setOrderForm({ ...orderForm, productId: event.target.value, packPrice: product?.costPrice == null ? '' : String(product.costPrice * (product.multiplier || 1)) }); }}>{stockedProducts.map((product) => <option value={product.id} key={product.id}>{product.name} · {product.packUnit}</option>)}</select></label>
          <label>จำนวนสั่งซื้อ ({selectedProduct?.packUnit || 'หน่วย'})<input required type="number" min="1" step="1" value={orderForm.quantity} onChange={(event) => setOrderForm({ ...orderForm, quantity: event.target.value })} /></label>
          <label>ราคาต่อหน่วยสั่งซื้อ (บาท)<input required type="number" min="0" step="0.01" value={orderForm.packPrice} onChange={(event) => setOrderForm({ ...orderForm, packPrice: event.target.value })} /></label>
        </div>
        <div className="purchase-total"><span>คาดว่าจะรับเข้า</span><strong>{receivedBaseQuantity.toLocaleString('th-TH')} {selectedProduct?.baseUnit || 'หน่วยเล็ก'} · ฿{total.toLocaleString('th-TH')}</strong></div>
        <div className="purchase-actions"><button type="button" className="modal-cancel" onClick={() => setModal(null)}>ยกเลิก</button><button className="modal-submit">สร้างใบสั่งซื้อ</button></div>
      </form>
    </div>}

    {modal?.type === 'receive' && <div className="customer-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}>
      <form className="customer-modal purchase-form-modal" onSubmit={receiveOrder}>
        <button type="button" className="modal-close" aria-label="ปิด" onClick={() => setModal(null)}>×</button>
        <h2>ตรวจรับสินค้า</h2>
        <p className="receive-po-summary">{modal.order.id} · {modal.order.item} · เหลือรับ {(modal.order.quantity - (modal.order.receivedQuantity || 0))} {modal.order.packUnit}</p>
        <div className="purchase-form-grid">
          <label>จำนวนที่รับ ({modal.order.packUnit})<input required type="number" min="1" max={modal.order.quantity - (modal.order.receivedQuantity || 0)} step="1" value={receiveForm.quantity} onChange={(event) => setReceiveForm({ ...receiveForm, quantity: event.target.value })} /></label>
          <label>วันที่รับเข้า<input required type="date" value={receiveForm.received} onChange={(event) => setReceiveForm({ ...receiveForm, received: event.target.value })} /></label>
          <label>หมายเลขล็อต (Lot No.)<input required value={receiveForm.batch} onChange={(event) => setReceiveForm({ ...receiveForm, batch: event.target.value })} /></label>
          <label>วันหมดอายุ (EXP)<input required type="date" value={receiveForm.expiry} onChange={(event) => setReceiveForm({ ...receiveForm, expiry: event.target.value })} /></label>
        </div>
        <div className="inventory-multiplier-preview">= {(Number(receiveForm.quantity) * (Number(modal.order.multiplier) || 1)).toLocaleString('th-TH')} {modal.order.item ? (products.find((product) => product.id === modal.order.productId)?.baseUnit || 'หน่วยเล็ก') : 'หน่วยเล็ก'} <span>ตามอัตรา 1 {modal.order.packUnit} = {modal.order.multiplier} หน่วยเล็ก</span></div>
        <div className="purchase-actions"><button type="button" className="modal-cancel" onClick={() => setModal(null)}>ยกเลิก</button><button className="modal-submit">บันทึกรับเข้า</button></div>
      </form>
    </div>}
  </div>;
}
