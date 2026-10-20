'use client';

import { useEffect, useMemo, useState } from 'react';
import { defaultSettings, readSettings } from '../../src/appSettings.js';
import { defaultInventory, getLotStatus, readInventory, saveInventory } from '../../src/inventoryStore.js';

const menuItems = [['Dashboard', '/dashboard'], ['หน้าร้าน', '/'], ['ลูกค้า', '/customers'], ['สัตว์เลี้ยง', '/pets'], ['สินค้า', '/products'], ['คลังสินค้า', '/inventory'], ['สั่งซื้อสินค้า', '/purchase-orders'], ['ผู้จัดจำหน่าย', '/suppliers'], ['สรุปยอดขาย', '/sales-reports'], ['จัดการพนักงาน', '/employees'], ['ตั้งค่า', '/settings']];
const emptyForm = { name: '', id: '', batch: '', expiry: '', received: '', units: '', packs: '' };

function SearchIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>; }

export default function InventoryPage() {
  const [items, setItems] = useState(defaultInventory);
  const [inventoryReady, setInventoryReady] = useState(false);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deductForm, setDeductForm] = useState({ quantity: '', reason: 'ของเสีย/หมดอายุ', note: '' });
  const [toast, setToast] = useState('');
  const [inventorySettings, setInventorySettings] = useState(defaultSettings);
  useEffect(() => {
    setItems(readInventory());
    setInventoryReady(true);
    function refreshSettings() { setInventorySettings(readSettings()); }
    refreshSettings();
    window.addEventListener('clinic-settings-updated', refreshSettings);
    window.addEventListener('storage', refreshSettings);
    return () => {
      window.removeEventListener('clinic-settings-updated', refreshSettings);
      window.removeEventListener('storage', refreshSettings);
    };
  }, []);
  useEffect(() => {
    if (inventoryReady) saveInventory(items);
  }, [inventoryReady, items]);
  const filteredItems = useMemo(() => {
    const value = query.trim().toLowerCase();
    return items
      .filter((item) => !value || [item.name, item.id, item.batch, item.status].some((field) => String(field).toLowerCase().includes(value)))
      .map((item) => ({ ...item, status: getLotStatus(item, inventorySettings) }));
  }, [items, query, inventorySettings]);
  function notify(message) { setToast(message); window.setTimeout(() => setToast(''), 2200); }
  function addStock(event) { event.preventDefault(); if (!form.name.trim() || !form.id.trim() || !form.batch.trim() || !form.units) { notify('กรุณากรอกชื่อสินค้า รหัส ล็อต และจำนวน'); return; } setItems((current) => [...current, { ...form, units: Number(form.units), packs: Number(form.packs || 0), status: 'ปกติ' }]); setModal(null); setForm(emptyForm); notify('บันทึกรับสินค้าเข้าแล้ว'); }
  function openDeduct(item) { setDeductForm({ quantity: '', reason: 'ของเสีย/หมดอายุ', note: '' }); setModal({ type: 'deduct', item }); }
  function deductStock(event) { event.preventDefault(); const quantity = Number(deductForm.quantity); if (!quantity || quantity < 1 || quantity > modal.item.units) { notify('กรุณาระบุจำนวนให้ถูกต้อง'); return; } setItems((current) => current.map((item) => item.id === modal.item.id && item.batch === modal.item.batch ? { ...item, units: item.units - quantity, status: item.units - quantity <= 20 ? 'สต็อกต่ำ' : item.status } : item)); setModal(null); notify(`ตัดสต็อก ${quantity} หน่วยแล้ว`); }
  return <div className="inventory-page"><aside className="sidebar"><div className="brand"><div className="brand-mark">TC</div><strong>Tle<span>Clinic</span></strong></div><nav>{menuItems.map(([label, href]) => <a className={label === 'คลังสินค้า' ? 'active' : ''} href={href} key={label}>{label}</a>)}</nav></aside><main className="inventory-main"><header className="inventory-header"><h1>คลังสินค้า</h1><button className="add-customer-button" onClick={() => { setForm(emptyForm); setModal({ type: 'add' }); }}><span>+</span> รับสินค้าเข้า</button></header><label className="customer-search"><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อสินค้า รหัส หรือล็อต..." /></label><section className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>ชื่อสินค้า</th><th>รหัส</th><th>หมายเลขล็อต</th><th>วันหมดอายุ</th><th>วันที่รับเข้า</th><th>คงเหลือหน่วยย่อย</th><th>หน่วยใหญ่</th><th>สถานะล็อต</th><th>จัดการ</th></tr></thead><tbody>{filteredItems.map((item) => <tr key={`${item.id}-${item.batch}`}><td>{item.name}</td><td className="mono">{item.id}</td><td className="mono">{item.batch}</td><td>{item.expiry}</td><td>{item.received}</td><td>{item.units} ซอง</td><td>{item.packs} กล่อง</td><td><span className={`lot-status ${item.status === 'ปกติ' ? 'normal' : item.status === 'ใกล้หมดอายุ' ? 'expiring' : 'low'}`}>{item.status}</span></td><td><button className="deduct-button" onClick={() => openDeduct(item)}>ตัดของ</button></td></tr>)}</tbody></table>{filteredItems.length === 0 && <div className="customer-empty">ไม่พบสินค้าในคลัง</div>}</section></main>{toast && <div className="toast"><b>OK</b>{toast}</div>}{modal?.type === 'add' && <div className="customer-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}><form className="customer-modal inventory-form-modal" onSubmit={addStock}><button type="button" className="modal-close" onClick={() => setModal(null)}>×</button><h2>รับสินค้าเข้า</h2><div className="inventory-form-grid"><label>ชื่อสินค้า<input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>วันหมดอายุ<input type="date" value={form.expiry} onChange={(event) => setForm({ ...form, expiry: event.target.value })} /></label><label>รหัส<input value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} /></label><label>วันที่รับเข้า<input type="date" value={form.received} onChange={(event) => setForm({ ...form, received: event.target.value })} /></label><label>หมายเลขล็อต<input value={form.batch} onChange={(event) => setForm({ ...form, batch: event.target.value })} /></label><label>คงเหลือหน่วยย่อย<input inputMode="numeric" value={form.units} onChange={(event) => setForm({ ...form, units: event.target.value })} /></label><label>หน่วยใหญ่<input inputMode="numeric" value={form.packs} onChange={(event) => setForm({ ...form, packs: event.target.value })} /></label></div><button className="modal-submit inventory-submit">บันทึก</button></form></div>}{modal?.type === 'deduct' && <div className="customer-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}><form className="customer-modal deduct-modal" onSubmit={deductStock}><button type="button" className="modal-close" onClick={() => setModal(null)}>×</button><h2>ตัดของเสีย / เบิกใช้ภายใน</h2><p>{modal.item.name} · ล็อต {modal.item.batch} · คงเหลือ {modal.item.units} หน่วย</p><label>จำนวน<input autoFocus inputMode="numeric" value={deductForm.quantity} onChange={(event) => setDeductForm({ ...deductForm, quantity: event.target.value })} /></label><label>สาเหตุ<select value={deductForm.reason} onChange={(event) => setDeductForm({ ...deductForm, reason: event.target.value })}><option>ของเสีย/หมดอายุ</option><option>เบิกใช้ภายใน</option><option>นับสต็อกปรับปรุง</option></select></label><label>หมายเหตุเพิ่มเติม<input value={deductForm.note} onChange={(event) => setDeductForm({ ...deductForm, note: event.target.value })} /></label><div className="deduct-actions"><button type="button" className="modal-cancel" onClick={() => setModal(null)}>ยกเลิก</button><button className="modal-submit">ยืนยัน</button></div></form></div>}</div>;
}
