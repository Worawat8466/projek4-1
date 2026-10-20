'use client';

import { useEffect, useMemo, useState } from 'react';
import { defaultProducts, readProducts, saveProducts } from '../../src/productStore.js';

const menuItems = [
  ['Dashboard', '/dashboard'], ['หน้าร้าน', '/'], ['ลูกค้า', '/customers'], ['สัตว์เลี้ยง', '/pets'],
  ['สินค้า', '/products'], ['คลังสินค้า', '/inventory'], ['สั่งซื้อสินค้า', '/purchase-orders'],
  ['ผู้จัดจำหน่าย', '/suppliers'], ['สรุปยอดขาย', '/sales-reports'], ['จัดการพนักงาน', '/employees'], ['ตั้งค่า', '/settings']
];

const emptyForm = {
  id: '', name: '', category: 'ยา', type: 'สินค้า', baseUnit: 'เม็ด',
  packUnit: 'กล่อง', multiplier: '1', salePrice: '', costPrice: '0', minimumStock: '0'
};

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
}

function EditIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-.8L19 8.4a2 2 0 0 0-2.8-2.8L5.4 16.4 4 20Z" /><path d="m14.8 6.2 3 3" /></svg>;
}

function DeleteIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M9 7V4h6v3m-9 0 1 14h8l1-14" /></svg>;
}

export default function ProductsPage() {
  const [products, setProducts] = useState(defaultProducts);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [toast, setToast] = useState('');

  useEffect(() => {
    setProducts(readProducts());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) saveProducts(products);
  }, [products, ready]);

  const filteredProducts = useMemo(() => {
    const value = query.trim().toLowerCase();
    return products.filter((product) =>
      !value || [product.id, product.name, product.category, product.type, product.baseUnit, product.packUnit]
        .some((field) => String(field).toLowerCase().includes(value))
    );
  }, [products, query]);

  const isStockItem = form.type === 'สินค้า';
  const multiplier = Math.max(1, Number(form.multiplier) || 1);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  }

  function openAdd() {
    setForm(emptyForm);
    setModal({ type: 'add' });
  }

  function openEdit(product) {
    setForm({
      ...emptyForm,
      ...product,
      multiplier: String(product.multiplier || 1),
      salePrice: String(product.salePrice),
      costPrice: product.costPrice == null ? '' : String(product.costPrice),
      minimumStock: String(product.minimumStock ?? 0)
    });
    setModal({ type: 'edit', product });
  }

  function saveProduct(event) {
    event.preventDefault();
    if (!form.id.trim() || !form.name.trim() || !form.salePrice || !form.baseUnit.trim() || !form.packUnit.trim()) {
      notify('กรุณากรอกรหัส ชื่อ หน่วย และราคาขาย');
      return;
    }
    if (isStockItem && (!Number(form.multiplier) || Number(form.multiplier) < 1)) {
      notify('อัตราแปลงต้องมากกว่าศูนย์');
      return;
    }

    const data = {
      id: form.id.trim(),
      name: form.name.trim(),
      category: form.category,
      type: form.type,
      baseUnit: form.baseUnit.trim(),
      packUnit: isStockItem ? form.packUnit.trim() : form.baseUnit.trim(),
      multiplier: isStockItem ? Number(form.multiplier) : 1,
      salePrice: Number(form.salePrice),
      costPrice: isStockItem ? (form.costPrice === '' ? null : Number(form.costPrice)) : null,
      minimumStock: isStockItem ? Number(form.minimumStock) || 0 : 0,
      tracksStock: isStockItem
    };

    if (modal.type === 'edit') {
      setProducts((current) => current.map((product) => product.id === modal.product.id ? data : product));
      notify('แก้ไขสินค้าแล้ว');
    } else {
      if (products.some((product) => product.id === data.id)) {
        notify('รหัสสินค้านี้มีอยู่แล้ว');
        return;
      }
      setProducts((current) => [...current, data]);
      notify('เพิ่มสินค้าแล้ว');
    }
    setModal(null);
  }

  function confirmDelete() {
    setProducts((current) => current.filter((product) => product.id !== modal.product.id));
    notify(`ลบ ${modal.product.name} แล้ว`);
    setModal(null);
  }

  return <div className="products-page">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">TC</div><strong>Tle<span>Clinic</span></strong></div>
      <nav>{menuItems.map(([label, href]) => <a className={label === 'สินค้า' ? 'active' : ''} href={href} key={label}>{label}</a>)}</nav>
    </aside>

    <main className="products-main">
      <header className="products-header"><div><p>แคตตาล็อกและหน่วยนับ</p><h1>สินค้า</h1></div><button className="add-customer-button" type="button" onClick={openAdd}><span>+</span> เพิ่มสินค้า</button></header>
      <label className="customer-search"><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาสินค้า รหัส หรือหมวดหมู่..." /></label>
      <section className="products-table-wrap" aria-label="รายการสินค้าและบริการ">
        <table className="products-table">
          <thead><tr><th>รหัส/บาร์โค้ด</th><th>ชื่อสินค้า/บริการ</th><th>หมวดหมู่</th><th>ประเภท</th><th>อัตราแปลง</th><th>ราคาขาย/หน่วยเล็ก</th><th>ราคาทุน/หน่วยเล็ก</th><th>สต็อกขั้นต่ำ</th><th>จัดการ</th></tr></thead>
          <tbody>{filteredProducts.map((product) => <tr key={product.id}>
            <td className="mono">{product.id}</td>
            <td>{product.name}</td>
            <td>{product.category}</td>
            <td><span className={`product-type ${product.tracksStock ? 'stock' : 'service'}`}>{product.tracksStock ? 'ตัดสต็อก' : 'บริการ'}</span></td>
            <td>{product.tracksStock ? `1 ${product.packUnit} = ${product.multiplier} ${product.baseUnit}` : `ขายเป็น ${product.baseUnit}`}</td>
            <td className="mono">฿{Number(product.salePrice).toLocaleString('th-TH')}</td>
            <td className="mono">{product.tracksStock ? product.costPrice == null ? 'ยังไม่ระบุ' : `฿${Number(product.costPrice).toLocaleString('th-TH')}` : '-'}</td>
            <td>{product.tracksStock ? `${product.minimumStock} ${product.baseUnit}` : '-'}</td>
            <td><div className="customer-row-actions"><button className="edit-action" type="button" aria-label={`แก้ไข ${product.name}`} title="แก้ไข" onClick={() => openEdit(product)}><EditIcon /></button><button className="delete-action" type="button" aria-label={`ลบ ${product.name}`} title="ลบ" onClick={() => setModal({ type: 'delete', product })}><DeleteIcon /></button></div></td>
          </tr>)}</tbody>
        </table>
        {filteredProducts.length === 0 && <div className="customer-empty">ไม่พบสินค้า</div>}
      </section>
    </main>

    {toast && <div className="toast" role="status"><b>OK</b>{toast}</div>}

    {(modal?.type === 'add' || modal?.type === 'edit') && <div className="customer-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}>
      <form className="customer-modal product-form-modal" onSubmit={saveProduct}>
        <button type="button" className="modal-close" aria-label="ปิด" onClick={() => setModal(null)}>×</button>
        <h2>{modal.type === 'edit' ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}</h2>
        <div className="product-form-grid">
          <label>รหัสสินค้า / บาร์โค้ด<input autoFocus required value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} /></label>
          <label>ชื่อสินค้า / บริการ<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>หมวดหมู่<input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
          <label>ประเภทรายการ<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="สินค้า">สินค้ามีตัวตน · ตัดสต็อก</option><option value="บริการ">บริการทางการแพทย์ · ไม่ตัดสต็อก</option></select></label>
          <label>หน่วยนับเล็กสุด (Base Unit)<input required value={form.baseUnit} onChange={(event) => setForm({ ...form, baseUnit: event.target.value })} placeholder="เช่น เม็ด, ซอง, ขวด" /></label>
          <label>หน่วยนับสั่งซื้อ (Pack Unit)<input required disabled={!isStockItem} value={isStockItem ? form.packUnit : form.baseUnit} onChange={(event) => setForm({ ...form, packUnit: event.target.value })} placeholder="เช่น กล่อง, ลัง" /></label>
          <label>อัตราส่วน (Multiplier)<input required disabled={!isStockItem} type="number" min="1" step="1" value={isStockItem ? form.multiplier : '1'} onChange={(event) => setForm({ ...form, multiplier: event.target.value })} /></label>
          <label>ราคาขายต่อหน่วยเล็ก<input required type="number" min="0" step="0.01" value={form.salePrice} onChange={(event) => setForm({ ...form, salePrice: event.target.value })} /></label>
          <label>ราคาทุนต่อหน่วยเล็ก<input disabled={!isStockItem} type="number" min="0" step="0.0001" value={isStockItem ? form.costPrice : '0'} onChange={(event) => setForm({ ...form, costPrice: event.target.value })} /></label>
          <label>สต็อกขั้นต่ำ (หน่วยเล็ก)<input disabled={!isStockItem} type="number" min="0" step="1" value={isStockItem ? form.minimumStock : '0'} onChange={(event) => setForm({ ...form, minimumStock: event.target.value })} /></label>
        </div>
        <div className="product-unit-preview">{isStockItem ? `1 ${form.packUnit || 'หน่วยสั่งซื้อ'} = ${multiplier} ${form.baseUnit || 'หน่วยเล็กสุด'}` : 'บริการนี้ไม่ตัดสต็อก'}</div>
        <button className="modal-submit product-submit" type="submit">{modal.type === 'edit' ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}</button>
      </form>
    </div>}

    {modal?.type === 'delete' && <div className="customer-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}>
      <section className="customer-modal delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="product-delete-title">
        <button type="button" className="modal-close" aria-label="ปิด" onClick={() => setModal(null)}>×</button>
        <h2 id="product-delete-title">ยืนยันการลบ</h2><p>ต้องการลบ {modal.product.name} หรือไม่</p>
        <div className="delete-modal-actions"><button type="button" className="modal-submit" onClick={confirmDelete}>ยืนยัน</button><button type="button" className="modal-cancel" onClick={() => setModal(null)}>ยกเลิก</button></div>
      </section>
    </div>}
  </div>;
}
