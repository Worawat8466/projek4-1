'use client';

import { useEffect, useMemo, useState } from 'react';
import { defaultSettings } from './appSettings.js';

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
const guestPet = { name: 'ไม่ระบุสัตว์เลี้ยง', breed: 'รายการทั่วไป' };
function toCatalogItem(product, inventory) {
  const category = product.category === 'อาหารสัตว์' ? 'food' : product.type === 'บริการ' ? 'service' : 'med';
  const stock = product.tracksStock
    ? inventory.filter((lot) => lot.id === product.id).reduce((total, lot) => total + Number(lot.units ?? lot.remainingBaseQuantity) || 0, 0)
    : null;
  return {
    ...product,
    shortName: product.shortName || product.name,
    category,
    type: product.tracksStock ? 'สินค้า' : 'บริการ',
    price: Number(product.salePrice) || 0,
    stock: product.tracksStock ? `${stock} ${product.baseUnit}` : '-'
  };
}

function SearchIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>; }
function ChevronIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>; }
function LockIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>; }

export default function App() {
  const [appSettings, setAppSettings] = useState(defaultSettings);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [pets, setPets] = useState([]);
  const [dataError, setDataError] = useState('');
  const [savingSale, setSavingSale] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [activePet, setActivePet] = useState('none');
  const [cart, setCart] = useState({ none: [] });
  const [petMenuOpen, setPetMenuOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [screenLocked, setScreenLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    let active = true;
    async function loadPosData() {
      try {
        const endpoints = ['/api/products', '/api/inventory/lots', '/api/customers', '/api/pets', '/api/settings'];
        const responses = await Promise.all(endpoints.map((endpoint) => fetch(endpoint)));
        if (responses.some((response) => !response.ok)) throw new Error('database_unavailable');
        const [productData, inventoryData, customerData, petData, settingsData] = await Promise.all(responses.map((response) => response.json()));
        if (!active) return;
        setProducts(productData.products);
        setInventory(inventoryData.lots);
        setCustomers(customerData.customers);
        setPets(petData.pets);
        setAppSettings(settingsData.settings);
        setDataError('');
      } catch {
        if (active) setDataError('เชื่อมต่อฐานข้อมูลไม่ได้ รายการขายถูกปิดไว้');
      }
    }
    loadPosData();
    return () => { active = false; };
  }, []);

  const petByKey = useMemo(() => Object.fromEntries([
    ['none', guestPet],
    ...pets.map((pet) => [String(pet.petId), pet])
  ]), [pets]);
  const customerPets = useMemo(() => selectedCustomer
    ? pets.filter((pet) => pet.ownerCode === selectedCustomer.id)
    : [], [pets, selectedCustomer]);
  const petChoices = useMemo(() => [['none', guestPet], ...customerPets.map((pet) => [String(pet.petId), pet]),], [customerPets]);
  const catalog = useMemo(() => products.map((product) => toCatalogItem(product, inventory)), [products, inventory]);
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
    return customers.filter((customer) => !value || [customer.name, customer.phone, customer.id].some((field) => String(field || '').toLowerCase().includes(value)));
  }, [customerQuery]);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  }

  function addItem(item) {
    if (item.tracksStock) {
      const available = inventory
        .filter((lot) => (lot.productId || lot.id) === item.id)
        .reduce((total, lot) => total + Number(lot.units || 0), 0);
      const inCart = Object.values(cart).flat()
        .filter((cartItem) => cartItem.id === item.id)
        .reduce((total, cartItem) => total + cartItem.qty, 0);
      if (inCart >= available) {
        notify(`สต็อก ${item.shortName} ไม่เพียงพอ`);
        return;
      }
    }
    setCart((current) => {
      const petCart = current[activePet] || [];
      const existing = petCart.find((cartItem) => cartItem.id === item.id);
      return { ...current, [activePet]: existing ? petCart.map((cartItem) => cartItem.id === item.id ? { ...cartItem, qty: cartItem.qty + 1 } : cartItem) : [...petCart, { ...item, qty: 1 }] };
    });
    notify(`เพิ่ม ${item.shortName} ให้ ${petByKey[activePet]?.name || guestPet.name}`);
  }

  function handleCatalogKeyDown(event) {
    if (event.key !== 'Enter') return;
    const barcode = query.trim().toLowerCase();
    const matchedItem = catalog.find((item) => item.id.toLowerCase() === barcode || item.barcode?.toLowerCase() === barcode);
    if (!matchedItem) return;
    event.preventDefault();
    addItem(matchedItem);
    setQuery('');
  }

  function updateQuantity(petKey, itemId, change) {
    const item = cart[petKey].find((cartItem) => cartItem.id === itemId);
    if (change > 0 && item?.tracksStock) {
      const available = inventory
        .filter((lot) => (lot.productId || lot.id) === itemId)
        .reduce((total, lot) => total + Number(lot.units || 0), 0);
      const inCart = Object.values(cart).flat()
        .filter((cartItem) => cartItem.id === itemId)
        .reduce((total, cartItem) => total + cartItem.qty, 0);
      if (inCart >= available) {
        notify(`สต็อก ${item.shortName} ไม่เพียงพอ`);
        return;
      }
    }
    setCart((current) => ({ ...current, [petKey]: current[petKey].map((item) => item.id === itemId ? { ...item, qty: item.qty + change } : item).filter((item) => item.qty > 0) }));
  }

  function moveItemToPet(sourcePet, itemId, destinationPet) {
    if (sourcePet === destinationPet) return;
    setCart((current) => {
      const item = current[sourcePet].find((cartItem) => cartItem.id === itemId);
      if (!item) return current;
      const destinationItems = current[destinationPet] || [];
      const matchingItem = destinationItems.find((cartItem) => cartItem.id === itemId);
      return {
        ...current,
        [sourcePet]: current[sourcePet].filter((cartItem) => cartItem.id !== itemId),
        [destinationPet]: matchingItem
          ? destinationItems.map((cartItem) => cartItem.id === itemId ? { ...cartItem, qty: cartItem.qty + item.qty } : cartItem)
          : [...destinationItems, item]
      };
    });
    notify(`ย้ายรายการไปให้${petByKey[destinationPet]?.name || guestPet.name}`);
  }

  function selectGuestCustomer() {
    setSelectedCustomer(null);
    setActivePet('none');
    setCart((current) => ({ none: Object.values(current).flat() }));
    notify('เข้าสู่โหมดขายลูกค้าทั่วไป');
  }

  async function confirmPayment() {
    if (savingSale) return;
    if (totals.quantity === 0 || net <= 0) {
      setPaymentMethod('');
      notify('ไม่มีรายการสำหรับบันทึกการขาย');
      return;
    }

    if (paymentMethod === 'เงินสด' && !appSettings.paymentMethods.cash || paymentMethod === 'พร้อมเพย์' && !appSettings.paymentMethods.promptpay) {
      setPaymentMethod('');
      notify('ช่องทางชำระเงินนี้ถูกปิดในตั้งค่า');
      return;
    }
    setSavingSale(true);
    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerCode: selectedCustomer?.id || null,
          paymentMethod,
          discountAmount: discount,
          vatRate: appSettings.vatRate,
          vatEnabled: appSettings.vatEnabled,
          receiptPrefix: appSettings.receiptPrefix,
          items: Object.entries(cart).flatMap(([petKey, petItems]) => petItems.map((item) => ({
            productCode: item.id,
            quantity: item.qty,
            petId: petKey === 'none' ? null : Number(petKey)
          })))
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'sale_failed');
      setPaymentMethod('');
      setCart({ none: [] });
      try {
        const inventoryResponse = await fetch('/api/inventory/lots');
        if (inventoryResponse.ok) setInventory((await inventoryResponse.json()).lots);
      } catch { /* The sale is already committed; refresh on the next page load. */ }
      notify(`บันทึกบิล ${result.sale.receiptNumber} สำเร็จ`);
    } catch (error) {
      const messages = {
        insufficient_stock: 'สต็อกไม่เพียงพอ ข้อมูลคลังถูกโหลดใหม่แล้ว',
        pet_not_owned: 'สัตว์เลี้ยงไม่ตรงกับเจ้าของที่เลือก',
        customer_not_found: 'ไม่พบลูกค้าที่เลือก'
      };
      notify(messages[error.message] || 'บันทึกยอดขายไม่สำเร็จ กรุณาตรวจสอบฐานข้อมูล');
      if (error.message === 'insufficient_stock') {
        const inventoryResponse = await fetch('/api/inventory/lots');
        if (inventoryResponse.ok) setInventory((await inventoryResponse.json()).lots);
      }
    } finally {
      setSavingSale(false);
    }
  }

  async function unlockScreen(event) {
    event.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) {
      setPinError('กรุณากรอก PIN 4-6 หลัก');
      return;
    }
    try {
      const response = await fetch('/api/auth/pin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const result = await response.json();
      if (result.valid) {
        setScreenLocked(false);
        setPin('');
        setPinError('');
        return;
      }
      setPinError('PIN ไม่ถูกต้อง');
    } catch {
      setPinError('ตรวจสอบ PIN ไม่สำเร็จ');
    }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">TC</div><strong>Tle<span>Clinic</span></strong></div>
      <nav>{menuItems.map(([label, href]) => <a className={label === 'หน้าร้าน' ? 'active' : ''} href={href} key={label}>{label}</a>)}</nav>
    </aside>

    <main className="workspace">
      <section className="catalog-panel">
        <header className="catalog-heading"><div><span>หน้าร้าน</span><h1>สินค้าและบริการ</h1></div><small>{filteredCatalog.length} รายการ</small></header>
        {dataError && <div className="empty-state" role="alert">{dataError}</div>}
        <label className="search-box"><SearchIcon /><input autoFocus value={query} onKeyDown={handleCatalogKeyDown} onChange={(event) => setQuery(event.target.value)} placeholder="ยิงบาร์โค้ดหรือค้นหาชื่อ / รหัสสินค้า..." /></label>
        <div className="toolbar">
          <div className="filters">{[['all', 'ทั้งหมด'], ['med', 'ยา/เวชภัณฑ์'], ['service', 'ค่าบริการ'], ['food', 'อาหารสัตว์']].map(([value, label]) => <button className={category === value ? 'selected' : ''} onClick={() => setCategory(value)} key={value}>{label}</button>)}</div>
          <div className="pet-picker">
            <button className="active-pet" onClick={() => setPetMenuOpen(!petMenuOpen)}><span className="pet-avatar-placeholder">{petByKey[activePet]?.name.slice(0, 1) || '-'}</span><span><b>{petByKey[activePet]?.name || guestPet.name}</b><small>{petByKey[activePet]?.breed || 'รายการทั่วไป'}</small></span><ChevronIcon /></button>
            {petMenuOpen && <div className="pet-menu">{petChoices.map(([key, pet]) => <button onClick={() => { setActivePet(key); setPetMenuOpen(false); }} key={key}><span className="pet-avatar-placeholder">{pet.name.slice(0, 1)}</span><span><b>{pet.name}</b><small>{pet.breed || pet.species || ''}</small></span></button>)}</div>}
          </div>
        </div>
        <div className="catalog-table-wrap"><table className="catalog-table"><thead><tr><th>รายการ / รหัสบาร์โค้ด</th><th>ประเภท</th><th>สต็อกคงเหลือ</th><th>ราคา/หน่วย</th><th>เพิ่ม</th></tr></thead><tbody>{filteredCatalog.map((item) => <tr onClick={() => addItem(item)} key={item.id}><td><b>{item.name}</b><small>{item.id}</small></td><td className={item.type === 'บริการ' ? 'service' : 'product'}>{item.type}</td><td className="mono">{item.stock}</td><td className="mono">฿{item.price}</td><td><button className="add-button" onClick={(event) => { event.stopPropagation(); addItem(item); }}>+</button></td></tr>)}</tbody></table>{filteredCatalog.length === 0 && <div className="empty-state">ไม่พบรายการที่ค้นหา</div>}</div>
      </section>

      <aside className="cart-panel">
        <div className="cart-header"><div><b>รายการขาย</b><small>{totals.quantity} รายการ · {Object.values(cart).filter((items) => items.length).length} สัตว์เลี้ยง</small></div><button className="lock-screen-button" type="button" title="ล็อกหน้าจอ" aria-label="ล็อกหน้าจอ" onClick={() => setScreenLocked(true)}><LockIcon /><span>ล็อก</span></button></div>
        <div className="customer-actions"><button className="customer-button" type="button" onClick={() => { setCustomerQuery(''); setCustomerModalOpen(true); }}>เลือกลูกค้า</button><button className="guest-button" type="button" onClick={selectGuestCustomer}>ลูกค้าทั่วไป</button></div>
        <div className="customer"><div className="customer-details"><b>{selectedCustomer ? selectedCustomer.name : 'ลูกค้าทั่วไป'}</b><small>{selectedCustomer ? selectedCustomer.phone : 'ไม่ระบุลูกค้า'}</small></div><div className="customer-avatar">{selectedCustomer ? selectedCustomer.name.slice(0, 1) : 'G'}</div></div>
        <div className="cart-list">{Object.entries(cart).filter(([, items]) => items.length > 0).map(([petKey, items]) => <div className="pet-cart" key={petKey}><div className="pet-label"><span className="pet-avatar-placeholder small">{petByKey[petKey]?.name.slice(0, 1) || '-'}</span><b>{petByKey[petKey]?.name || guestPet.name}</b></div><div className="cart-items">{items.map((item) => <div className="cart-row" key={item.id}><div className="cart-item-details"><b>{item.shortName}</b><small className={`cart-item-type ${item.type === 'บริการ' ? 'service' : 'product'}`}>{item.type === 'บริการ' ? 'บริการ · ไม่ตัดสต็อก' : `สินค้า · ${item.baseUnit}`}</small><select aria-label={`สัตว์เลี้ยงของ ${item.shortName}`} value={petKey} onChange={(event) => moveItemToPet(petKey, item.id, event.target.value)}>{petChoices.map(([key, pet]) => <option value={key} key={key}>{pet.name}</option>)}</select></div><div className="cart-controls"><div className="quantity"><button aria-label={`ลด ${item.shortName}`} onClick={() => updateQuantity(petKey, item.id, -1)}>-</button><span>{item.qty}</span><button aria-label={`เพิ่ม ${item.shortName}`} onClick={() => updateQuantity(petKey, item.id, 1)}>+</button></div><strong className="mono">฿{item.price * item.qty}</strong></div></div>)}</div></div>)}{totals.quantity === 0 && <div className="cart-empty"><span>ยังไม่มีสินค้าในบิล</span><small>สแกนบาร์โค้ดหรือเลือกรายการเพื่อเริ่มขาย</small></div>}</div>
        <div className="summary"><div className="summary-line"><span>ยอดรวม ({totals.quantity} รายการ)</span><strong className="mono">฿{totals.subtotal}</strong></div>{discount > 0 && <div className="summary-line discount"><span>ส่วนลด</span><strong className="mono">-฿{discount}</strong></div>}{appSettings.vatEnabled && <div className="summary-line"><span>VAT ({appSettings.vatRate}%)</span><strong className="mono">฿{tax.toFixed(2)}</strong></div>}<div className="summary-line net"><b>ยอดชำระสุทธิ:</b><strong className="mono">฿{net.toFixed(2)}</strong></div><div className="payment-buttons">{appSettings.paymentMethods.promptpay && <button disabled={totals.quantity === 0 || Boolean(dataError)} onClick={() => setPaymentMethod('พร้อมเพย์')}>พร้อมเพย์</button>}{appSettings.paymentMethods.cash && <button disabled={totals.quantity === 0 || Boolean(dataError)} onClick={() => setPaymentMethod('เงินสด')}>เงินสด</button>}</div></div>
      </aside>
    </main>
    {toast && <div className="toast"><b>OK</b>{toast}</div>}
    {paymentMethod && <div className="modal-backdrop"><div className="modal"><div className="modal-icon">OK</div><h2>ยืนยันการรับชำระเงิน</h2><p>ช่องทาง: <b>{paymentMethod}</b></p><div className="modal-total"><small>ยอดชำระสุทธิ</small><strong className="mono">฿{net}</strong></div><div className="modal-actions"><button disabled={savingSale} onClick={() => setPaymentMethod('')}>ยกเลิก</button><button disabled={savingSale} onClick={confirmPayment}>{savingSale ? 'กำลังบันทึก...' : 'บันทึกการขาย'}</button></div></div></div>}
    {customerModalOpen && <div className="customer-picker-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCustomerModalOpen(false)}><section className="customer-picker" role="dialog" aria-modal="true" aria-labelledby="customer-picker-title"><button className="modal-close" type="button" aria-label="ปิด" onClick={() => setCustomerModalOpen(false)}>×</button><h2 id="customer-picker-title">เลือกลูกค้า</h2><p>ค้นหาและเลือกลูกค้าสำหรับรายการขายนี้</p><label className="customer-picker-search"><SearchIcon /><input autoFocus value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="ค้นหาชื่อ เบอร์โทร หรือไอดี..." /></label><div className="customer-picker-list">{filteredCustomers.map((customer) => <button type="button" className={selectedCustomer?.id === customer.id ? 'selected' : ''} key={customer.id} onClick={() => { setSelectedCustomer(customer); setCart((current) => ({ none: Object.values(current).flat() })); const firstPet = pets.find((pet) => pet.ownerCode === customer.id); setActivePet(firstPet ? String(firstPet.petId) : 'none'); setCustomerModalOpen(false); notify(`เลือกลูกค้า ${customer.name} แล้ว`); }}><span className="picker-avatar">{customer.name.slice(0, 1)}</span><span><b>{customer.name}</b><small>{customer.phone} · สัตว์เลี้ยง {customer.petCount} ตัว</small></span><span className="picker-id mono">{customer.id}</span></button>)}{filteredCustomers.length === 0 && <div className="customer-picker-empty">ไม่พบข้อมูลลูกค้า</div>}</div><button className="picker-guest" type="button" onClick={() => { selectGuestCustomer(); setCustomerModalOpen(false); }}>ขายให้ลูกค้าทั่วไป</button></section></div>}
    {screenLocked && <div className="screen-lock"><form className="screen-lock-card" onSubmit={unlockScreen}><div className="screen-lock-mark">TC</div><h2>หน้าจอถูกล็อก</h2><p>กรอก PIN เพื่อกลับเข้าสู่หน้าร้าน</p><input autoFocus inputMode="numeric" maxLength="6" pattern="[0-9]*" type="password" value={pin} onChange={(event) => { setPin(event.target.value.replace(/\D/g, '')); setPinError(''); }} placeholder="PIN 4-6 หลัก" /><span className="screen-lock-error">{pinError}</span><button type="submit">ปลดล็อก</button></form></div>}
  </div>;
}