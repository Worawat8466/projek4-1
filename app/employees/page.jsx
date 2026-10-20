'use client';

import { useMemo, useState } from 'react';

const menuItems = [
  ['Dashboard', '/dashboard'], ['หน้าร้าน', '/'], ['ลูกค้า', '/customers'], ['สัตว์เลี้ยง', '/pets'],
  ['สินค้า', '/products'], ['คลังสินค้า', '/inventory'], ['สั่งซื้อสินค้า', '/purchase-orders'],
  ['ผู้จัดจำหน่าย', '/suppliers'], ['สรุปยอดขาย', '/sales-reports'], ['จัดการพนักงาน', '/employees'], ['ตั้งค่า', '/settings']
];

const roles = ['ผู้ดูแลระบบ', 'สัตวแพทย์', 'ผู้ช่วย', 'พนักงานหน้าร้าน'];
const initialEmployees = [
  { id: 'EMP-001', name: 'ณัชพัฒน์ รังษา', role: 'สัตวแพทย์', email: 'natchapat@vpclinic.com', phone: '081-222-3333' },
  { id: 'EMP-002', name: 'วรวรรษ ห้องจำปา', role: 'ผู้ช่วย', email: 'worawat@vpclinic.com', phone: '082-131-4444' }
];

const emptyForm = { firstName: '', lastName: '', role: '', email: '', phone: '' };

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
}

function EditIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-.8L19 8.4a2 2 0 0 0-2.8-2.8L5.4 16.4 4 20Z" /><path d="m14.8 6.2 3 3" /></svg>;
}

function DeleteIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M9 7V4h6v3m-9 0 1 14h8l1-14" /></svg>;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState(initialEmployees);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [toast, setToast] = useState('');

  const filteredEmployees = useMemo(() => {
    const value = query.trim().toLowerCase();
    return employees.filter((employee) =>
      !value || [employee.name, employee.role, employee.email, employee.phone]
        .some((field) => field.toLowerCase().includes(value))
    );
  }, [employees, query]);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  }

  function openAddModal() {
    setForm(emptyForm);
    setModal({ type: 'add' });
  }

  function openEditModal(employee) {
    const [firstName = '', ...lastNameParts] = employee.name.split(' ');
    setForm({ firstName, lastName: lastNameParts.join(' '), role: employee.role, email: employee.email, phone: employee.phone });
    setModal({ type: 'edit', employee });
  }

  function saveEmployee(event) {
    event.preventDefault();
    const employeeData = {
      name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
      role: form.role,
      email: form.email.trim(),
      phone: form.phone.trim()
    };

    if (modal.type === 'edit') {
      setEmployees((current) => current.map((employee) =>
        employee.id === modal.employee.id ? { ...employee, ...employeeData } : employee
      ));
      notify('บันทึกการแก้ไขพนักงานแล้ว');
    } else {
      setEmployees((current) => [
        ...current,
        { id: `EMP-${String(Date.now()).slice(-6)}`, ...employeeData }
      ]);
      notify('เพิ่มพนักงานแล้ว');
    }
    setModal(null);
  }

  function confirmDelete() {
    setEmployees((current) => current.filter((employee) => employee.id !== modal.employee.id));
    notify(`ลบข้อมูล ${modal.employee.name} แล้ว`);
    setModal(null);
  }

  return <div className="employees-page">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">TC</div><strong>Tle<span>Clinic</span></strong></div>
      <nav>{menuItems.map(([label, href]) => <a className={label === 'จัดการพนักงาน' ? 'active' : ''} href={href} key={label}>{label}</a>)}</nav>
    </aside>

    <main className="employees-main">
      <header className="employees-header">
        <div><p>บุคลากรและสิทธิ์การใช้งาน</p><h1>จัดการพนักงาน</h1></div>
        <button className="employee-add-button" type="button" onClick={openAddModal}><span aria-hidden="true">+</span> เพิ่มพนักงาน</button>
      </header>

      <label className="employee-search">
        <SearchIcon />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อ อีเมล เบอร์โทร หรือบทบาท..." />
      </label>

      <section className="employees-table-wrap" aria-label="รายชื่อพนักงาน">
        <table className="employees-table">
          <thead><tr><th>ชื่อพนักงาน</th><th>บทบาทหน้าที่</th><th>อีเมล</th><th>เบอร์โทรศัพท์</th><th>จัดการ</th></tr></thead>
          <tbody>{filteredEmployees.map((employee) => <tr key={employee.id}>
            <td><b>{employee.name}</b><small>{employee.id}</small></td>
            <td><span className={`employee-role ${employee.role === 'ผู้ดูแลระบบ' ? 'admin' : ''}`}>{employee.role}</span></td>
            <td className="employee-email">{employee.email}</td>
            <td className="employee-phone">{employee.phone}</td>
            <td><div className="employee-actions">
              <button type="button" className="edit-action" aria-label={`แก้ไข ${employee.name}`} title="แก้ไข" onClick={() => openEditModal(employee)}><EditIcon /></button>
              <button type="button" className="delete-action" aria-label={`ลบ ${employee.name}`} title="ลบ" onClick={() => setModal({ type: 'delete', employee })}><DeleteIcon /></button>
            </div></td>
          </tr>)}</tbody>
        </table>
        {filteredEmployees.length === 0 && <div className="employee-empty">ไม่พบพนักงานที่ค้นหา</div>}
      </section>
    </main>

    {toast && <div className="toast" role="status"><b>OK</b>{toast}</div>}

    {(modal?.type === 'add' || modal?.type === 'edit') && <div className="employee-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}>
      <form className="employee-modal employee-form-modal" onSubmit={saveEmployee}>
        <button type="button" className="modal-close" aria-label="ปิด" onClick={() => setModal(null)}>×</button>
        <h2>{modal.type === 'edit' ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงาน'}</h2>
        <label className="employee-field">ชื่อ<input autoFocus required value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label>
        <label className="employee-field">นามสกุล<input required value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label>
        <label className="employee-field">อีเมล<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label className="employee-field">เบอร์โทรศัพท์<input required type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
        <label className="employee-field employee-field-wide">บทบาทหน้าที่<select required value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="" disabled>เลือกบทบาท</option>{roles.map((role) => <option key={role}>{role}</option>)}</select></label>
        <div className="employee-modal-actions">
          <button type="button" className="employee-cancel-button" onClick={() => setModal(null)}>ยกเลิก</button>
          <button type="submit" className="employee-confirm-button">{modal.type === 'edit' ? 'บันทึกการแก้ไข' : 'เพิ่มพนักงาน'}</button>
        </div>
      </form>
    </div>}

    {modal?.type === 'delete' && <div className="employee-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}>
      <section className="employee-modal employee-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="employee-delete-title">
        <h2 id="employee-delete-title">ยืนยันการลบ</h2>
        <p>ต้องการลบข้อมูลพนักงาน <b>{modal.employee.name}</b> หรือไม่</p>
        <div className="employee-modal-actions">
          <button type="button" className="employee-cancel-button" onClick={() => setModal(null)}>ยกเลิก</button>
          <button type="button" className="employee-delete-confirm" onClick={confirmDelete}>ลบพนักงาน</button>
        </div>
      </section>
    </div>}
  </div>;
}