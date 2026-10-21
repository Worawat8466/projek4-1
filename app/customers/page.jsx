'use client';

import { useEffect, useMemo, useState } from 'react';
import ProfilePhotoField, { ProfileAvatar, uploadProfilePhoto } from '../../src/ProfilePhotoField.jsx';

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

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
}

function EditIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-.8L19 8.4a2 2 0 0 0-2.8-2.8L5.4 16.4 4 20Z" /><path d="m14.8 6.2 3 3" /></svg>;
}

function DeleteIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M9 7V4h6v3m-9 0 1 14h8l1-14" /></svg>;
}

function HistoryIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5M12 7v5l3 2" /></svg>;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', surname: '', phone: '' });
  const [photoFile, setPhotoFile] = useState(null);
  const [historyQuery, setHistoryQuery] = useState('');

  useEffect(() => {
    fetch('/api/customers')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'load_failed');
        setCustomers(result.customers);
      })
      .catch(() => notify('โหลดลูกค้าจากฐานข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, []);

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.id, customer.phone].some((value) => value.toLowerCase().includes(normalizedQuery))
    );
  }, [customers, query]);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  }

  function openAddModal() {
    setForm({ name: '', surname: '', phone: '' });
    setPhotoFile(null);
    setModal({ type: 'add' });
  }

  function openEditModal(customer) {
    const [name, ...surnameParts] = customer.name.split(' ');
    setForm({ name, surname: surnameParts.join(' '), phone: customer.phone === '-' ? '' : customer.phone });
    setPhotoFile(null);
    setModal({ type: 'edit', customer });
  }

  async function saveCustomer(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      notify('กรุณากรอกชื่อและเบอร์โทร');
      return;
    }

    const customerData = { firstName: form.name.trim(), lastName: form.surname.trim(), phone: form.phone.trim() };
    try {
      const response = await fetch(modal.type === 'edit' ? `/api/customers/${encodeURIComponent(modal.customer.id)}` : '/api/customers', {
        method: modal.type === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerData)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'save_failed');
      let savedCustomer = result.customer;
      if (photoFile) {
        try {
          savedCustomer = { ...savedCustomer, photoUrl: await uploadProfilePhoto('customers', savedCustomer.id, photoFile) };
        } catch {
          notify('บันทึกข้อมูลลูกค้าแล้ว แต่บันทึกรูปไม่สำเร็จ');
        }
      }
      if (modal.type === 'edit') setCustomers((current) => current.map((customer) => customer.id === modal.customer.id ? savedCustomer : customer));
      else setCustomers((current) => [...current, savedCustomer]);
      if (!photoFile) notify(modal.type === 'edit' ? 'แก้ไขข้อมูลลูกค้าแล้ว' : 'เพิ่มลูกค้าใหม่แล้ว');
      setModal(null);
    } catch {
      notify('บันทึกลูกค้าไม่สำเร็จ กรุณาตรวจการเชื่อมต่อฐานข้อมูล');
    }
  }

  function deleteCustomer(customer) {
    setModal({ type: 'delete', customer });
  }

  function openHistoryModal(customer) {
    setHistoryQuery('');
    setModal({ type: 'history', customer });
  }

  async function confirmDelete() {
    const customer = modal.customer;
    try {
      const response = await fetch(`/api/customers/${encodeURIComponent(customer.id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('delete_failed');
      setCustomers((current) => current.filter((item) => item.id !== customer.id));
      notify(`ปิดใช้งานข้อมูล ${customer.name} แล้ว`);
      setModal(null);
    } catch {
      notify('ปิดใช้งานลูกค้าไม่สำเร็จ');
    }
  }

  return (
    <div className="customer-page">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">TC</div><strong>Tle<span>Clinic</span></strong></div>
        <nav>{menuItems.map(([label, href]) => <a className={label === 'ลูกค้า' ? 'active' : ''} href={href} key={label}>{label}</a>)}</nav>
      </aside>

      <main className="customer-main">
        <header className="customer-header">
          <h1>ลูกค้า</h1>
          <button className="add-customer-button" onClick={openAddModal}><span>+</span> เพิ่มลูกค้า</button>
        </header>

        <label className="customer-search"><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อ เบอร์โทร..." /></label>

        <section className="customer-table-wrap">
          <table className="customer-table">
            <thead><tr><th>ชื่อลูกค้า</th><th>ไอดี</th><th>ติดต่อ</th><th>สัตว์เลี้ยง</th><th>วันที่สมัคร</th><th>ประวัติ</th><th>จัดการ</th></tr></thead>
            <tbody>
              {filteredCustomers.map((customer) => <tr key={customer.id}>
                <td><div className="profile-name-cell"><ProfileAvatar src={customer.photoUrl} name={customer.name} />{customer.name}</div></td><td className="mono">{customer.id}</td><td className="mono">{customer.phone || '-'}</td><td>{customer.petCount || 0}</td><td>{customer.createdAt ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(customer.createdAt)) : '-'}</td>
                <td><button className="history-action" aria-label={`ดูประวัติ ${customer.name}`} title="ดูประวัติ" onClick={() => openHistoryModal(customer)}><HistoryIcon /></button></td>
                <td><div className="customer-row-actions"><button className="edit-action" aria-label={`แก้ไข ${customer.name}`} title="แก้ไข" onClick={() => openEditModal(customer)}><EditIcon /></button><button className="delete-action" aria-label={`ลบ ${customer.name}`} title="ลบ" onClick={() => deleteCustomer(customer)}><DeleteIcon /></button></div></td>
              </tr>)}
            </tbody>
          </table>
          {!loading && filteredCustomers.length === 0 && <div className="customer-empty">{query ? 'ไม่พบข้อมูลลูกค้า' : 'ยังไม่มีลูกค้าในฐานข้อมูล'}</div>}
        </section>
      </main>
      {toast && <div className="toast"><b>OK</b>{toast}</div>}
      {modal?.type !== 'delete' && modal && <div className="customer-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}>
        <form className="customer-modal customer-form-modal" onSubmit={saveCustomer}>
          <button type="button" className="modal-close" aria-label="ปิด" onClick={() => setModal(null)}>×</button>
          <h2>{modal.type === 'edit' ? 'แก้ไข' : 'เพิ่มลูกค้า'}</h2>
          <ProfilePhotoField name={`${form.name} ${form.surname}`} src={modal.type === 'edit' ? modal.customer.photoUrl : ''} onFileChange={setPhotoFile} />
          <label>ชื่อ<input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>นามสกุล<input value={form.surname} onChange={(event) => setForm({ ...form, surname: event.target.value })} /></label>
          <label>เบอร์โทร<input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
          <button className="modal-submit" type="submit">{modal.type === 'edit' ? 'ยืนยันแก้ไข' : 'เพิ่ม'}</button>
        </form>
      </div>}
      {modal?.type === 'delete' && <div className="customer-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}>
        <div className="customer-modal delete-modal">
          <button type="button" className="modal-close" aria-label="ปิด" onClick={() => setModal(null)}>×</button>
          <h2>ยืนยันการลบ</h2>
          <p>ต้องการลบข้อมูล {modal.customer.name} หรือไม่</p>
          <div className="delete-modal-actions"><button type="button" className="modal-submit" onClick={confirmDelete}>ยืนยัน</button><button type="button" className="modal-cancel" onClick={() => setModal(null)}>ยกเลิก</button></div>
        </div>
      </div>}
      {modal?.type === 'history' && <div className="customer-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}>
        <section className="customer-modal history-modal">
          <button type="button" className="modal-close" aria-label="ปิด" onClick={() => setModal(null)}>×</button>
          <div className="history-heading"><div><h2>ประวัติ:{modal.customer.name}</h2><p>เลขที่ลูกค้า <b>{modal.customer.id}</b></p></div></div>
          <label className="history-search"><SearchIcon /><input value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="เลขที่บิล..." /></label>
          <div className="history-table-wrap"><table className="history-table"><thead><tr><th>วันที่</th><th>เลขที่บิล</th><th>สัตว์เลี้ยง</th><th>สรุปรายการ</th><th>จำนวน</th><th>ยอดชำระ</th><th>ช่องทาง</th></tr></thead><tbody>{(modal.customer.history || []).filter((entry) => entry.date.includes(historyQuery) || entry.bill.includes(historyQuery)).map((entry) => <tr key={entry.bill}><td>{entry.date}</td><td className="mono">{entry.bill}</td><td>{entry.pet}</td><td>{entry.summary.split('\n').map((line) => <div key={line}>{line}</div>)}</td><td>{entry.quantity.split('\n').map((line) => <div key={line}>{line}</div>)}</td><td>{entry.total}</td><td>{entry.method}</td></tr>)}</tbody></table>{(modal.customer.history || []).length === 0 && <div className="customer-empty">ยังไม่มีประวัติการใช้บริการ</div>}</div>
        </section>
      </div>}
    </div>
  );
}
