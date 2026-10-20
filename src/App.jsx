'use client';

import { useEffect, useMemo, useState } from 'react';
import { appendSale } from './salesLedger.js';
import { defaultSettings, readSettings } from './appSettings.js';

const menuItems = [
  ['Dashboard', '/dashboard'],
  ['หน้าร้าน', '/'],
  ['ลูกค้า', '/customers'],
  ['สัตว์เลี้ยง', '/pets'],
  ['สินค้า', '/products'],
  ['คลังสินค้า', '/inventory'],
  ['สั่งซื้อสินค้า', '/purchase-orders'],
  ['ผู้จัดจำหน่าย', '/suppliers'],
  ['สรุปยอดขาย', '/sales-reports'],
  ['จัดการพนักงาน', '/employees'],
  ['ตั้งค่า', '/settings']
];
const pets = {
  pet1: { name: 'เจ้าแมวน้ำ', breed: 'Golden Retriever', image: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=120&auto=format&fit=crop&q=70' },
  pet2: { name: 'เจ้าแมวน้ำ2', breed: 'Golden Retriever (ตัวเล็ก)', image: 'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?w=120&auto=format&fit=crop&q=70' },
  none: { name: 'ไม่ระบุสัตว์เลี้ยง', breed: 'รายการทั่วไป', image: null }
};
const catalog = [
  { id: 'MED-001', name: 'ยาพารา (Paracetamol)', shortName: 'ยาพารา', category: 'med', type: 'สินค้า', price: 200, stock: '120 แผง' },
  { id: 'SRV-001', name: 'ตรวจสุขภาพทั่วไป', shortName: 'ตรวจสุขภาพ', category: 'service', type: 'บริการ', price: 150, stock: '-' },
  { id: 'MED-002', name: 'วัคซีนรวมสุนัข 5 โรค', shortName: 'วัคซีนรวมสุนัข', category: 'med', type: 'สินค้า', price: 350, stock: '15 โดส' },
  { id: 'SRV-002', name: 'ค่าบริการฉีดวัคซีน/ทำแผล', shortName: 'ฉีดวัคซีน/ทำแผล', category: 'service', type: 'บริการ', price: 100, stock: '-' },
  { id: 'FOD-001', name: 'Royal Canin Golden Retriever 3kg', shortName: 'อาหารสุนัข Royal Canin', category: 'food', type: 'สินค้า', price: 850, stock: '10 ถุง' }
];
const initialCart = {
  pet1: [{ ...catalog[0], qty: 1 }, { ...catalog[1], qty: 1 }],
  pet2: [{ ...catalog[0], qty: 1 }, { ...catalog[1], qty: 1 }],
  none: []
};
const customers = [
  { id: '123456', name: 'แมว1', phone: '082-666-7777', pets: 2 },
  { id: '654321', name: 'แมว2', phone: '080-555-7777', pets: 1 },
  { id: '975310', name: 'คุณสมชาย', phone: '089-999-9999', pets: 3 }
];

function SearchIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>; }
function ChevronIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>; }
function LockIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>; }

export default function App() {
  const [appSettings, setAppSettings] = useState(defaultSettings);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [activePet, setActivePet] = useState('pet1');
  const [cart, setCart] = useState(initialCart);
  const [petMenuOpen, setPetMenuOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [screenLocked, setScreenLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(customers[2]);

  useEffect(() => {
    function refreshSettings() {
      setAppSettings(readSettings());
    }
    refreshSettings();
    window.addEventListener('clinic-settings-updated', refreshSettings);
    window.addEventListener('storage', refreshSettings);
    return () => {
      window.removeEventListener('clinic-settings-updated', refreshSettings);
      window.removeEventListener('storage', refreshSettings);
    };
  }, []);

  const filteredCatalog = useMemo(() => catalog.filter((item) => {
    const matchesCategory = category === 'all' || item.category === category;
    const searchable = `${item.name} ${item.id}`.toLowerCase();
    return matchesCategory && searchable.includes(query.toLowerCase());
  }), [category, query]);

  const totals = useMemo(() => Object.values(cart).flat().reduce((result, item) => ({
    quantity: result.quantity + item.qty,
    subtotal: result.subtotal + item.price * item.qty
  }), { quantity: 0, subtotal: 0 }), [cart]);
  const discount = Math.min(totals.subtotal, Math.max(0, Number(appSettings.defaultDiscount) || 0));
  const taxableAmount = Math.max(0, totals.subtotal - discount);
  const tax = appSettings.vatEnabled ? Math.round(taxableAmount * (Number(appSettings.vatRate) || 0)) / 100 : 0;
  const net = taxableAmount + tax;
  const filteredCustomers = useMemo(() => {
    const value = customerQuery.trim().toLowerCase();
    return customers.filter((customer) => !value || [customer.name, customer.phone, customer.id].some((field) => field.toLowerCase().includes(value)));
  }, [customerQuery]);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  }

  function addItem(item) {
    setCart((current) => {
      const petCart = current[activePet];
      const existing = petCart.find((cartItem) => cartItem.id === item.id);
      return { ...current, [activePet]: existing ? petCart.map((cartItem) => cartItem.id === item.id ? { ...cartItem, qty: cartItem.qty + 1 } : cartItem) : [...petCart, { ...item, qty: 1 }] };
    });
    notify(`เพิ่ม ${item.shortName} ให้ ${pets[activePet].name}`);
  }

  function handleCatalogKeyDown(event) {
    if (event.key !== 'Enter') return;
    const barcode = query.trim().toLowerCase();
    const matchedItem = catalog.find((item) => item.id.toLowerCase() === barcode);
    if (!matchedItem) return;
    event.preventDefault();
    addItem(matchedItem);
    setQuery('');
  }

  function updateQuantity(petKey, itemId, change) {
    setCart((current) => ({ ...current, [petKey]: current[petKey].map((item) => item.id === itemId ? { ...item, qty: item.qty + change } : item).filter((item) => item.qty > 0) }));
  }

  function confirmPayment() {
    const items = Object.entries(cart).flatMap(([petKey, petItems]) => petItems.map((item) => ({
      productId: item.id,
      name: item.name,
      type: item.type,
      petName: pets[petKey].name,
      quantity: item.qty,
      unitPrice: item.price,
      unitCost: typeof item.costPrice === 'number' ? item.costPrice : null,
      lineTotal: item.price * item.qty
    })));
    if (items.length === 0 || net <= 0) {
      setPaymentMethod('');
      notify('ไม่มีรายการสำหรับบันทึกการขาย');
      return;
    }
    const now = new Date();
    const sale = {
      id: `${appSettings.receiptPrefix || 'INV-'}${now.getTime()}`,
      soldAt: now.toISOString(),
      customerName: selectedCustomer?.name || 'ลูกค้าทั่วไป',
      paymentMethod,
      subtotal: totals.subtotal,
      discount,
      netSales: taxableAmount,
      tax,
      total: net,
      items
    };
    if (!appendSale(sale)) {
      notify('บันทึกยอดขายไม่สำเร็จ กรุณาลองอีกครั้ง');
      return;
    }
    setPaymentMethod('');
    setCart({ pet1: [], pet2: [], none: [] });
    notify('บันทึกการขายสำเร็จ และพิมพ์ใบเสร็จเรียบร้อย');
  }

  function unlockScreen(event) {
    event.preventDefault();
    if (/^\d{4,6}$/.test(pin)) {
      setScreenLocked(false);
      setPin('');
      setPinError('');
      return;
    }
    setPinError('กรุณากรอก PIN 4-6 หลัก');
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">TC</div><strong>Tle<span>Clinic</span></strong></div>
      <nav>{menuItems.map(([label, href]) => <a className={label === 'หน้าร้าน' ? 'active' : ''} href={href} key={label}>{label}</a>)}</nav>
    </aside>

    <main className="workspace">
      <section className="catalog-panel">
        <header className="catalog-heading"><div><span>หน้าร้าน</span><h1>สินค้าและบริการ</h1></div><small>{filteredCatalog.length} รายการ</small></header>
        <label className="search-box"><SearchIcon /><input autoFocus value={query} onKeyDown={handleCatalogKeyDown} onChange={(event) => setQuery(event.target.value)} placeholder="ยิงบาร์โค้ดหรือค้นหาชื่อ / รหัสสินค้า..." /></label>
        <div className="toolbar">
          <div className="filters">{[['all', 'ทั้งหมด'], ['med', 'ยา/เวชภัณฑ์'], ['service', 'ค่าบริการ'], ['food', 'อาหารสัตว์']].map(([value, label]) => <button className={category === value ? 'selected' : ''} onClick={() => setCategory(value)} key={value}>{label}</button>)}</div>
          <div className="pet-picker">
            <button className="active-pet" onClick={() => setPetMenuOpen(!petMenuOpen)}>{pets[activePet].image ? <img src={pets[activePet].image} alt="" /> : <span className="pet-avatar-placeholder">-</span>}<span><b>{pets[activePet].name}</b><small>{pets[activePet].breed}</small></span><ChevronIcon /></button>
            {petMenuOpen && <div className="pet-menu">{Object.entries(pets).map(([key, pet]) => <button onClick={() => { setActivePet(key); setPetMenuOpen(false); }} key={key}>{pet.image ? <img src={pet.image} alt="" /> : <span className="pet-avatar-placeholder">-</span>}<span><b>{pet.name}</b><small>{pet.breed}</small></span></button>)}</div>}
          </div>
        </div>
        <div className="catalog-table-wrap"><table className="catalog-table"><thead><tr><th>รายการ / รหัสบาร์โค้ด</th><th>ประเภท</th><th>สต็อกคงเหลือ</th><th>ราคา/หน่วย</th><th>เพิ่ม</th></tr></thead><tbody>{filteredCatalog.map((item) => <tr onClick={() => addItem(item)} key={item.id}><td><b>{item.name}</b><small>{item.id}</small></td><td className={item.type === 'บริการ' ? 'service' : 'product'}>{item.type}</td><td className="mono">{item.stock}</td><td className="mono">฿{item.price}</td><td><button className="add-button" onClick={(event) => { event.stopPropagation(); addItem(item); }}>+</button></td></tr>)}</tbody></table>{filteredCatalog.length === 0 && <div className="empty-state">ไม่พบรายการที่ค้นหา</div>}</div>
      </section>

      <aside className="cart-panel">
        <div className="cart-header"><div><b>รายการขาย</b><small>{totals.quantity} รายการ · {Object.values(cart).filter((items) => items.length).length} สัตว์เลี้ยง</small></div><button className="lock-screen-button" type="button" title="ล็อกหน้าจอ" aria-label="ล็อกหน้าจอ" onClick={() => setScreenLocked(true)}><LockIcon /><span>ล็อก</span></button></div>
        <div className="customer-actions"><button className="customer-button" type="button" onClick={() => { setCustomerQuery(''); setCustomerModalOpen(true); }}>เลือกลูกค้า</button><button className="guest-button" type="button" onClick={() => { setSelectedCustomer(null); notify('เข้าสู่โหมดขายลูกค้าทั่วไป'); }}>ลูกค้าทั่วไป</button></div>
        <div className="customer"><div className="customer-details"><b>{selectedCustomer ? selectedCustomer.name : 'ลูกค้าทั่วไป'}</b><small>{selectedCustomer ? selectedCustomer.phone : 'ไม่ระบุลูกค้า'}</small></div><div className="customer-avatar">{selectedCustomer ? selectedCustomer.name.slice(0, 1) : 'G'}</div></div>
        <div className="cart-list">{Object.entries(cart).filter(([, items]) => items.length > 0).map(([petKey, items]) => <div className="pet-cart" key={petKey}><div className="cart-items">{items.map((item) => <div className="cart-row" key={item.id}><div><b>{item.shortName}</b><small className={item.type === 'บริการ' ? 'service' : 'product'}>{item.type}</small></div><div className="cart-controls"><div className="quantity"><button aria-label={`ลด ${item.shortName}`} onClick={() => updateQuantity(petKey, item.id, -1)}>-</button><span>{item.qty}</span><button aria-label={`เพิ่ม ${item.shortName}`} onClick={() => updateQuantity(petKey, item.id, 1)}>+</button></div><strong className="mono">฿{item.price * item.qty}</strong></div></div>)}</div><div className="pet-label">{pets[petKey].image ? <img src={pets[petKey].image} alt="" /> : <span className="pet-avatar-placeholder small">-</span>}<b>{pets[petKey].name}</b></div></div>)}{totals.quantity === 0 && <div className="cart-empty"><span>ยังไม่มีสินค้าในบิล</span><small>สแกนบาร์โค้ดหรือเลือกรายการเพื่อเริ่มขาย</small></div>}</div>
        <div className="summary"><div className="summary-line"><span>ยอดรวม ({totals.quantity} รายการ)</span><strong className="mono">฿{totals.subtotal}</strong></div>{discount > 0 && <div className="summary-line discount"><span>ส่วนลด</span><strong className="mono">-฿{discount}</strong></div>}{appSettings.vatEnabled && <div className="summary-line"><span>VAT ({appSettings.vatRate}%)</span><strong className="mono">฿{tax.toFixed(2)}</strong></div>}<div className="summary-line net"><b>ยอดชำระสุทธิ:</b><strong className="mono">฿{net.toFixed(2)}</strong></div><div className="payment-buttons">{appSettings.paymentMethods.promptpay && <button disabled={totals.quantity === 0} onClick={() => setPaymentMethod('พร้อมเพย์')}>พร้อมเพย์</button>}{appSettings.paymentMethods.cash && <button disabled={totals.quantity === 0} onClick={() => setPaymentMethod('เงินสด')}>เงินสด</button>}</div></div>
      </aside>
    </main>
    {toast && <div className="toast"><b>OK</b>{toast}</div>}
    {paymentMethod && <div className="modal-backdrop"><div className="modal"><div className="modal-icon">OK</div><h2>ยืนยันการรับชำระเงิน</h2><p>ช่องทาง: <b>{paymentMethod}</b></p><div className="modal-total"><small>ยอดชำระสุทธิ</small><strong className="mono">฿{net}</strong></div><div className="modal-actions"><button onClick={() => setPaymentMethod('')}>ยกเลิก</button><button onClick={confirmPayment}>บันทึกและพิมพ์ใบเสร็จ</button></div></div></div>}
    {customerModalOpen && <div className="customer-picker-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCustomerModalOpen(false)}><section className="customer-picker" role="dialog" aria-modal="true" aria-labelledby="customer-picker-title"><button className="modal-close" type="button" aria-label="ปิด" onClick={() => setCustomerModalOpen(false)}>×</button><h2 id="customer-picker-title">เลือกลูกค้า</h2><p>ค้นหาและเลือกลูกค้าสำหรับรายการขายนี้</p><label className="customer-picker-search"><SearchIcon /><input autoFocus value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="ค้นหาชื่อ เบอร์โทร หรือไอดี..." /></label><div className="customer-picker-list">{filteredCustomers.map((customer) => <button type="button" className={selectedCustomer?.id === customer.id ? 'selected' : ''} key={customer.id} onClick={() => { setSelectedCustomer(customer); setCustomerModalOpen(false); notify(`เลือกลูกค้า ${customer.name} แล้ว`); }}><span className="picker-avatar">{customer.name.slice(0, 1)}</span><span><b>{customer.name}</b><small>{customer.phone} · สัตว์เลี้ยง {customer.pets} ตัว</small></span><span className="picker-id mono">{customer.id}</span></button>)}{filteredCustomers.length === 0 && <div className="customer-picker-empty">ไม่พบข้อมูลลูกค้า</div>}</div><button className="picker-guest" type="button" onClick={() => { setSelectedCustomer(null); setCustomerModalOpen(false); notify('เข้าสู่โหมดขายลูกค้าทั่วไป'); }}>ขายให้ลูกค้าทั่วไป</button></section></div>}
    {screenLocked && <div className="screen-lock"><form className="screen-lock-card" onSubmit={unlockScreen}><div className="screen-lock-mark">TC</div><h2>หน้าจอถูกล็อก</h2><p>กรอก PIN เพื่อกลับเข้าสู่หน้าร้าน</p><input autoFocus inputMode="numeric" maxLength="6" pattern="[0-9]*" type="password" value={pin} onChange={(event) => { setPin(event.target.value.replace(/\D/g, '')); setPinError(''); }} placeholder="PIN 4-6 หลัก" /><span className="screen-lock-error">{pinError}</span><button type="submit">ปลดล็อก</button></form></div>}
  </div>;
}