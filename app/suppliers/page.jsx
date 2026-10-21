'use client';

import { useEffect, useMemo, useState } from 'react';

const menuItems = [
  ['Dashboard', '/dashboard'], ['หน้าร้าน', '/'], ['ลูกค้า', '/customers'], ['สัตว์เลี้ยง', '/pets'],
  ['สินค้า', '/products'], ['คลังสินค้า', '/inventory'], ['สั่งซื้อสินค้า', '/purchase-orders'],
  ['ผู้จัดจำหน่าย', '/suppliers'], ['สรุปยอดขาย', '/sales-reports'], ['จัดการพนักงาน', '/employees'], ['ตั้งค่า', '/settings']
];

const emptyForm = { name: '', contact: '', phone: '', email: '', active: true };

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
}

function EditIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-.8L19 8.4a2 2 0 0 0-2.8-2.8L5.4 16.4 4 20Z" /><path d="m14.8 6.2 3 3" /></svg>;
}

function DeleteIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M9 7V4h6v3m-9 0 1 14h8l1-14" /></svg>;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [toast, setToast] = useState('');

  useEffect(() => {
    fetch('/api/suppliers')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'load_failed');
        setSuppliers(result.suppliers);
      })
      .catch(() => notify('โหลดผู้จัดจำหน่ายจากฐานข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, []);

  const filteredSuppliers = useMemo(() => {
    const value = query.trim().toLowerCase();
    return suppliers.filter((supplier) =>
      !value || [supplier.name, supplier.contact, supplier.phone, supplier.email]
        .some((field) => field.toLowerCase().includes(value))
    );
  }, [suppliers, query]);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  }

  function openAddModal() {
    setForm(emptyForm);
    setModal({ type: 'add' });
  }

  function openEditModal(supplier) {
    setForm({ name: supplier.name, contact: supplier.contact, phone: supplier.phone, email: supplier.email, active: supplier.active });
    setModal({ type: 'edit', supplier });
  }

  async function saveSupplier(event) {
    event.preventDefault();
    const supplierData = {
      ...form,
      name: form.name.trim(),
      contact: form.contact.trim(),
      phone: form.phone.trim(),
      email: form.email.trim()
    };

    try {
      const response = await fetch(modal.type === 'edit' ? `/api/suppliers/${encodeURIComponent(modal.supplier.id)}` : '/api/suppliers', {
        method: modal.type === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplierData)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'save_failed');
      if (modal.type === 'edit') setSuppliers((current) => current.map((supplier) => supplier.id === modal.supplier.id ? result.supplier : supplier));
      else setSuppliers((current) => [...current, result.supplier]);
      notify(modal.type === 'edit' ? 'บันทึกการแก้ไขผู้จัดจำหน่ายแล้ว' : 'เพิ่มผู้จัดจำหน่ายแล้ว');
      setModal(null);
    } catch {
      notify('บันทึกผู้จัดจำหน่ายไม่สำเร็จ กรุณาตรวจการเชื่อมต่อฐานข้อมูล');
    }
  }

  async function confirmDelete() {
    try {
      const response = await fetch(`/api/suppliers/${encodeURIComponent(modal.supplier.id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('delete_failed');
      setSuppliers((current) => current.map((supplier) => supplier.id === modal.supplier.id ? { ...supplier, active: false } : supplier));
      notify(`ปิดใช้งาน ${modal.supplier.name} แล้ว`);
      setModal(null);
    } catch {
      notify('ปิดใช้งานผู้จัดจำหน่ายไม่สำเร็จ');
    }
  }

  return <div className="suppliers-page">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">TC</div><strong>Tle<span>Clinic</span></strong></div>
      <nav>{menuItems.map(([label, href]) => <a className={label === 'ผู้จัดจำหน่าย' ? 'active' : ''} href={href} key={label}>{label}</a>)}</nav>
    </aside>

    <main className="suppliers-main">
      <header className="suppliers-header">
        <h1>ผู้จัดจำหน่าย</h1>
        <button className="supplier-add-button" type="button" onClick={openAddModal}><span aria-hidden="true">+</span> เพิ่มผู้จัดจำหน่าย</button>
      </header>

      <label className="supplier-search">
        <SearchIcon />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อบริษัท ผู้ติดต่อ หรือเบอร์โทร..." />
      </label>

      <section className="suppliers-table-wrap" aria-label="รายชื่อผู้จัดจำหน่าย">
        <table className="suppliers-table">
          <thead><tr><th>ผู้จัดจำหน่าย / บริษัท</th><th>ชื่อผู้ติดต่อ / เซลส์</th><th>เบอร์โทรศัพท์</th><th>สถานะ</th><th><span className="sr-only">จัดการ</span></th></tr></thead>
          <tbody>{filteredSuppliers.map((supplier) => <tr key={supplier.id}>
            <td><b>{supplier.name}</b><small>{supplier.email}</small></td>
            <td>{supplier.contact}</td>
            <td className="supplier-phone">{supplier.phone}</td>
            <td><span className={`supplier-status ${supplier.active ? 'active' : 'inactive'}`}>{supplier.active ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}</span></td>
            <td><div className="supplier-actions">
              <button type="button" className="edit-action" aria-label={`แก้ไข ${supplier.name}`} title="แก้ไข" onClick={() => openEditModal(supplier)}><EditIcon /></button>
              <button type="button" className="delete-action" aria-label={`ลบ ${supplier.name}`} title="ลบ" onClick={() => setModal({ type: 'delete', supplier })}><DeleteIcon /></button>
            </div></td>
          </tr>)}</tbody>
        </table>
        {loading ? <div className="supplier-empty">กำลังโหลดผู้จัดจำหน่าย...</div> : filteredSuppliers.length === 0 && <div className="supplier-empty">{query ? 'ไม่พบผู้จัดจำหน่ายที่ค้นหา' : 'ยังไม่มีผู้จัดจำหน่ายในฐานข้อมูล'}</div>}
      </section>
    </main>

    {toast && <div className="toast" role="status"><b>OK</b>{toast}</div>}

    {(modal?.type === 'add' || modal?.type === 'edit') && <div className="supplier-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}>
      <form className="supplier-modal supplier-form-modal" onSubmit={saveSupplier}>
        <button type="button" className="modal-close" aria-label="ปิด" onClick={() => setModal(null)}>×</button>
        <h2>{modal.type === 'edit' ? 'แก้ไขผู้จัดจำหน่าย' : 'เพิ่มผู้จัดจำหน่าย'}</h2>
        <label className="supplier-field supplier-field-wide">ชื่อผู้จัดจำหน่าย / บริษัท<input autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label className="supplier-field">ชื่อผู้ติดต่อ / เซลส์<input required value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} /></label>
        <label className="supplier-field">เบอร์โทรศัพท์<input required type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
        <label className="supplier-field">อีเมลติดต่อสั่งซื้อ<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label className="supplier-active-toggle"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span>ใช้งานผู้จัดจำหน่ายรายนี้</span></label>
        <div className="supplier-modal-actions">
          <button type="button" className="supplier-cancel-button" onClick={() => setModal(null)}>ยกเลิก</button>
          <button type="submit" className="supplier-confirm-button">{modal.type === 'edit' ? 'บันทึกการแก้ไข' : 'เพิ่มผู้จัดจำหน่าย'}</button>
        </div>
      </form>
    </div>}

    {modal?.type === 'delete' && <div className="supplier-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}>
      <section className="supplier-modal supplier-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="supplier-delete-title">
        <h2 id="supplier-delete-title">ยืนยันการลบ</h2>
        <p>ต้องการลบผู้จัดจำหน่าย <b>{modal.supplier.name}</b> หรือไม่</p>
        <div className="supplier-modal-actions">
          <button type="button" className="supplier-cancel-button" onClick={() => setModal(null)}>ยกเลิก</button>
          <button type="button" className="supplier-delete-confirm" onClick={confirmDelete}>ลบผู้จัดจำหน่าย</button>
        </div>
      </section>
    </div>}
  </div>;
}