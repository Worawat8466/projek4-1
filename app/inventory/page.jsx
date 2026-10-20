'use client';

import { useEffect, useMemo, useState } from 'react';
import { defaultSettings, readSettings } from '../../src/appSettings.js';
import { defaultInventory, getLotStatus, readInventory } from '../../src/inventoryStore.js';
import { commitInventoryMovement } from '../../src/inventoryMovements.js';
import { defaultProducts, readProducts } from '../../src/productStore.js';

const menuItems = [
  ['Dashboard', '/dashboard'], ['หน้าร้าน', '/'], ['ลูกค้า', '/customers'], ['สัตว์เลี้ยง', '/pets'],
  ['สินค้า', '/products'], ['คลังสินค้า', '/inventory'], ['สั่งซื้อสินค้า', '/purchase-orders'],
  ['ผู้จัดจำหน่าย', '/suppliers'], ['สรุปยอดขาย', '/sales-reports'], ['จัดการพนักงาน', '/employees'], ['ตั้งค่า', '/settings']
];

const emptyReceiveForm = { productId: '', packQuantity: '1', batch: '', expiry: '', received: new Date().toISOString().slice(0, 10) };
const emptyDeductForm = { quantity: '', reason: 'ของเสีย', note: '' };
const deductReasons = ['ของเสีย', 'หมดอายุ', 'แพทย์เบิกใช้ในห้องตรวจ', 'นับสต็อกปรับปรุง'];

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
}

function displayDate(value) {
  if (!value) return '-';
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  const date = isoMatch
    ? new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
    : (() => {
      const [day, month, year] = String(value).split('/').map(Number);
      return day && month && year ? new Date(year >= 2400 ? year - 543 : year, month - 1, day) : null;
    })();
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }).format(date)
    : String(value);
}

export default function InventoryPage() {
  const [items, setItems] = useState(defaultInventory);
  const [products, setProducts] = useState(defaultProducts);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [receiveForm, setReceiveForm] = useState(emptyReceiveForm);
  const [deductForm, setDeductForm] = useState(emptyDeductForm);
  const [toast, setToast] = useState('');
  const [inventorySettings, setInventorySettings] = useState(defaultSettings);

  useEffect(() => {
    setItems(readInventory());
    setProducts(readProducts());
    setInventorySettings(readSettings());
    function refreshSharedData() {
      setProducts(readProducts());
      setInventorySettings(readSettings());
    }
    window.addEventListener('clinic-settings-updated', refreshSharedData);
    window.addEventListener('clinic-products-updated', refreshSharedData);
    window.addEventListener('storage', refreshSharedData);
    return () => {
      window.removeEventListener('clinic-settings-updated', refreshSharedData);
      window.removeEventListener('clinic-products-updated', refreshSharedData);
      window.removeEventListener('storage', refreshSharedData);
    };
  }, []);

  const trackedProducts = useMemo(() => products.filter((product) => product.tracksStock), [products]);
  const selectedProduct = trackedProducts.find((product) => product.id === receiveForm.productId) || trackedProducts[0];
  const multiplier = Number(selectedProduct?.multiplier) || 1;
  const receivedBaseQuantity = (Number(receiveForm.packQuantity) || 0) * multiplier;
  const filteredItems = useMemo(() => {
    const value = query.trim().toLowerCase();
    return items
      .map((item) => ({ ...item, status: getLotStatus(item, inventorySettings) }))
      .filter((item) => !value || [item.name, item.id, item.batch, item.status].some((field) => String(field).toLowerCase().includes(value)));
  }, [items, query, inventorySettings]);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  }

  function openReceiveModal() {
    setReceiveForm({ ...emptyReceiveForm, productId: trackedProducts[0]?.id || '' });
    setModal({ type: 'receive' });
  }

  function receiveStock(event) {
    event.preventDefault();
    if (!selectedProduct || !receiveForm.batch.trim() || !receiveForm.expiry || !Number(receiveForm.packQuantity) || Number(receiveForm.packQuantity) < 1) {
      notify('กรุณาระบุสินค้า จำนวน ล็อต และวันหมดอายุ');
      return;
    }

    const duplicateLot = items.find((item) => item.id === selectedProduct.id && item.batch.trim().toLowerCase() === receiveForm.batch.trim().toLowerCase());
    const receivedAt = new Date(`${receiveForm.received || new Date().toISOString().slice(0, 10)}T00:00:00`).toISOString();
    const lot = duplicateLot
      ? { ...duplicateLot, units: Number(duplicateLot.units) + receivedBaseQuantity, packs: Number(duplicateLot.packs || 0) + Number(receiveForm.packQuantity) }
      : {
        id: selectedProduct.id,
        productId: selectedProduct.id,
        name: selectedProduct.name,
        batch: receiveForm.batch.trim(),
        expiry: receiveForm.expiry,
        received: receiveForm.received,
        receivedAt,
        units: receivedBaseQuantity,
        packs: Number(receiveForm.packQuantity),
        baseUnit: selectedProduct.baseUnit,
        packUnit: selectedProduct.packUnit,
        multiplier,
        unitCostBase: selectedProduct.costPrice ?? null,
        status: 'ปกติ'
      };
    const nextItems = duplicateLot
      ? items.map((item) => item.id === duplicateLot.id && item.batch === duplicateLot.batch ? lot : item)
      : [...items, lot];

    const movementSaved = commitInventoryMovement(nextItems, {
      productId: selectedProduct.id,
      batch: lot.batch,
      movementType: 'RECEIVE',
      packQuantity: Number(receiveForm.packQuantity),
      packUnit: selectedProduct.packUnit,
      multiplier,
      baseQuantity: receivedBaseQuantity,
      reason: 'รับสินค้าจากคลัง/ผู้จัดจำหน่าย'
    });
    if (!movementSaved) {
      notify('บันทึกรับสินค้าไม่สำเร็จ');
      return;
    }
    setItems(nextItems);
    setModal(null);
    notify(movementSaved ? `รับเข้า ${receivedBaseQuantity} ${selectedProduct.baseUnit} แล้ว` : 'รับสินค้าแล้ว แต่บันทึกประวัติ movement ไม่สำเร็จ');
  }

  function openDeductModal(item) {
    setDeductForm(emptyDeductForm);
    setModal({ type: 'deduct', item });
  }

  function deductStock(event) {
    event.preventDefault();
    const quantity = Number(deductForm.quantity);
    if (!quantity || quantity < 1 || quantity > Number(modal.item.units)) {
      notify('จำนวนที่ตัดต้องมากกว่า 0 และไม่เกินยอดคงเหลือของล็อต');
      return;
    }

    const movementType = deductForm.reason === 'แพทย์เบิกใช้ในห้องตรวจ' ? 'CLINIC_USE' : deductForm.reason === 'นับสต็อกปรับปรุง' ? 'ADJUST' : 'WASTE';
    const nextItems = items.map((item) => item.id === modal.item.id && item.batch === modal.item.batch
      ? { ...item, units: Number(item.units) - quantity }
      : item);
    const movementSaved = commitInventoryMovement(nextItems, {
      productId: modal.item.id,
      batch: modal.item.batch,
      movementType,
      baseQuantity: quantity,
      reason: deductForm.reason,
      note: deductForm.note.trim()
    });
    if (!movementSaved) {
      notify('ตัดสต็อกไม่สำเร็จ');
      return;
    }
    setItems(nextItems);
    setModal(null);
    notify(movementSaved ? `ตัด ${quantity} ${modal.item.baseUnit || 'หน่วย'} แล้ว` : 'สต็อกถูกตัดแล้ว แต่บันทึกประวัติ movement ไม่สำเร็จ');
  }

  return <div className="inventory-page">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">TC</div><strong>Tle<span>Clinic</span></strong></div>
      <nav>{menuItems.map(([label, href]) => <a className={label === 'คลังสินค้า' ? 'active' : ''} href={href} key={label}>{label}</a>)}</nav>
    </aside>

    <main className="inventory-main">
      <header className="inventory-header"><div><p>รายล็อตและวันหมดอายุ</p><h1>คลังสินค้า</h1></div><button className="add-customer-button" type="button" onClick={openReceiveModal}><span>+</span> รับสินค้าเข้า</button></header>
      <label className="customer-search"><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อสินค้า รหัส หรือล็อต..." /></label>
      <section className="inventory-table-wrap" aria-label="สต็อกแยกตามล็อต">
        <table className="inventory-table">
          <thead><tr><th>ชื่อสินค้า</th><th>รหัส</th><th>หมายเลขล็อต</th><th>วันหมดอายุ</th><th>วันที่รับเข้า</th><th>คงเหลือหน่วยเล็ก</th><th>รับเข้า</th><th>สถานะล็อต</th><th>จัดการ</th></tr></thead>
          <tbody>{filteredItems.map((item) => <tr key={`${item.id}-${item.batch}`}>
            <td>{item.name}</td><td className="mono">{item.id}</td><td className="mono">{item.batch}</td>
            <td>{displayDate(item.expiry)}</td><td>{displayDate(item.received)}</td>
            <td>{item.units} {item.baseUnit || 'หน่วย'}</td><td>{item.packs} {item.packUnit || 'หน่วย'}</td>
            <td><span className={`lot-status ${item.status === 'ปกติ' ? 'normal' : item.status === 'ใกล้หมดอายุ' ? 'expiring' : 'low'}`}>{item.status}</span></td>
            <td><button className="deduct-button" type="button" disabled={Number(item.units) <= 0} onClick={() => openDeductModal(item)}>ตัดของ</button></td>
          </tr>)}</tbody>
        </table>
        {filteredItems.length === 0 && <div className="customer-empty">ไม่พบสินค้าในคลัง</div>}
      </section>
    </main>

    {toast && <div className="toast" role="status"><b>OK</b>{toast}</div>}

    {modal?.type === 'receive' && <div className="customer-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}>
      <form className="customer-modal inventory-form-modal" onSubmit={receiveStock}>
        <button type="button" className="modal-close" aria-label="ปิด" onClick={() => setModal(null)}>×</button>
        <h2>รับสินค้าเข้าคลัง</h2>
        <div className="inventory-form-grid">
          <label className="wide">สินค้า / เวชภัณฑ์<select autoFocus required value={receiveForm.productId} onChange={(event) => setReceiveForm({ ...receiveForm, productId: event.target.value })}>{trackedProducts.map((product) => <option value={product.id} key={product.id}>{product.name} · {product.id}</option>)}</select></label>
          <label>จำนวนรับเข้า ({selectedProduct?.packUnit || 'หน่วย'})<input required type="number" min="1" step="1" value={receiveForm.packQuantity} onChange={(event) => setReceiveForm({ ...receiveForm, packQuantity: event.target.value })} /></label>
          <label>หมายเลขล็อต (Lot No.)<input required value={receiveForm.batch} onChange={(event) => setReceiveForm({ ...receiveForm, batch: event.target.value })} /></label>
          <label>วันหมดอายุ (EXP)<input required type="date" value={receiveForm.expiry} onChange={(event) => setReceiveForm({ ...receiveForm, expiry: event.target.value })} /></label>
          <label>วันที่รับเข้า<input required type="date" value={receiveForm.received} onChange={(event) => setReceiveForm({ ...receiveForm, received: event.target.value })} /></label>
        </div>
        <div className="inventory-multiplier-preview">= {receivedBaseQuantity.toLocaleString('th-TH')} {selectedProduct?.baseUnit || 'หน่วยเล็ก'} <span>ตามอัตราแปลง 1 {selectedProduct?.packUnit} = {multiplier} {selectedProduct?.baseUnit}</span></div>
        <div className="inventory-form-actions"><button type="button" className="modal-cancel" onClick={() => setModal(null)}>ยกเลิก</button><button className="modal-submit inventory-submit" type="submit">บันทึกรับเข้า</button></div>
      </form>
    </div>}

    {modal?.type === 'deduct' && <div className="customer-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}>
      <form className="customer-modal deduct-modal" onSubmit={deductStock}>
        <button type="button" className="modal-close" aria-label="ปิด" onClick={() => setModal(null)}>×</button>
        <h2>ตัดสต็อก</h2>
        <p>{modal.item.name} · ล็อต {modal.item.batch} · คงเหลือ {modal.item.units} {modal.item.baseUnit || 'หน่วย'}</p>
        <label>จำนวนที่ตัด<input autoFocus required type="number" min="1" max={modal.item.units} step="1" value={deductForm.quantity} onChange={(event) => setDeductForm({ ...deductForm, quantity: event.target.value })} /></label>
        <label>เหตุผล<select value={deductForm.reason} onChange={(event) => setDeductForm({ ...deductForm, reason: event.target.value })}>{deductReasons.map((reason) => <option key={reason}>{reason}</option>)}</select></label>
        <label>หมายเหตุ<input value={deductForm.note} onChange={(event) => setDeductForm({ ...deductForm, note: event.target.value })} placeholder="ระบุรายละเอียดเพิ่มเติม (ถ้ามี)" /></label>
        <div className="deduct-actions"><button type="button" className="modal-cancel" onClick={() => setModal(null)}>ยกเลิก</button><button className="modal-submit">ยืนยันตัดสต็อก</button></div>
      </form>
    </div>}
  </div>;
}
