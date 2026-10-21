'use client';

import { useEffect, useMemo, useState } from 'react';
import ProfilePhotoField, { ProfileAvatar, uploadProfilePhoto } from '../../src/ProfilePhotoField.jsx';

const menuItems = [
  ['Dashboard', '/dashboard'], ['หน้าร้าน', '/'], ['ลูกค้า', '/customers'], ['สัตว์เลี้ยง', '/pets'],
  ['สินค้า', '/products'], ['คลังสินค้า', '/inventory'], ['สั่งซื้อสินค้า', '/purchase-orders'], ['ผู้จัดจำหน่าย', '/suppliers'],
  ['สรุปยอดขาย', '/sales-reports'], ['จัดการพนักงาน', '/employees'], ['ตั้งค่า', '/settings']
];

const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const days = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0'));
const years = Array.from({ length: 80 }, (_, index) => String(2579 - index));

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
}
function EditIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-.8L19 8.4a2 2 0 0 0-2.8-2.8L5.4 16.4 4 20Z" /><path d="m14.8 6.2 3 3" /></svg>;
}
function DeleteIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M9 7V4h6v3m-9 0 1 14h8l1-14" /></svg>;
}

function displayDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return value && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
    : '-';
}

export default function PetsPage() {
  const [pets, setPets] = useState([]);
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', owner: '', breed: '', id: '', gender: 'ชาย', species: 'สุนัข', birthDay: '', birthMonth: '', birthYear: '' });
  const [toast, setToast] = useState('');
  const [ownerQuery, setOwnerQuery] = useState('');
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false);
  const [photoPetId, setPhotoPetId] = useState('');

  useEffect(() => {
    Promise.all([fetch('/api/pets'), fetch('/api/customers')])
      .then(async ([petsResponse, customersResponse]) => {
        const [petsResult, customersResult] = await Promise.all([petsResponse.json(), customersResponse.json()]);
        if (!petsResponse.ok || !customersResponse.ok) throw new Error('load_failed');
        setPets(petsResult.pets);
        if (petsResult.pets.length) setPhotoPetId((current) => current || petsResult.pets[0].id);
        setOwners(customersResult.customers);
      })
      .catch(() => notify('โหลดข้อมูลสัตว์เลี้ยง/ลูกค้าจากฐานข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false));
  }, []);

  const filteredOwners = useMemo(() => {
    const value = ownerQuery.trim().toLowerCase();
    return owners.filter((owner) => owner.name.toLowerCase().includes(value) || owner.id.toLowerCase().includes(value));
  }, [ownerQuery]);

  const filteredPets = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return pets;
    return pets.filter((pet) => [pet.name, pet.owner, pet.breed, pet.id, pet.species].some((field) => String(field || '').toLowerCase().includes(value)));
  }, [pets, query]);
  const selectedPhotoPet = pets.find((pet) => pet.id === photoPetId);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  }

  async function savePetPhoto(file) {
    if (!selectedPhotoPet || !file) return;
    try {
      const photoUrl = await uploadProfilePhoto('pets', selectedPhotoPet.id, file);
      setPets((current) => current.map((pet) => pet.id === selectedPhotoPet.id ? { ...pet, photoUrl } : pet));
      notify(`บันทึกรูปโปรไฟล์ ${selectedPhotoPet.name} แล้ว`);
    } catch {
      notify('บันทึกรูปไม่สำเร็จ กรุณาใช้ JPEG, PNG หรือ WebP ขนาดไม่เกิน 5 MB');
    }
  }

  function openAddModal() {
    setForm({ name: '', owner: '', breed: '', id: '', gender: 'ชาย', species: 'สุนัข', birthDay: '', birthMonth: '', birthYear: '' });
    setOwnerQuery('');
    setOwnerMenuOpen(false);
    setModal({ type: 'add' });
  }

  function openEditModal(pet) {
    const [year, month, day] = String(pet.birth || '').split('-');
    setForm({ name: pet.name, owner: pet.ownerCode, breed: pet.breed, id: pet.id, gender: pet.gender, species: pet.species || 'สุนัข', birthDay: day || '', birthMonth: month || '', birthYear: year ? String(Number(year) + 543) : '' });
    setOwnerQuery(pet.owner);
    setOwnerMenuOpen(false);
    setModal({ type: 'edit', pet });
  }

  async function savePet(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.owner || !form.breed.trim() || !form.id.trim()) {
      notify('กรุณากรอกชื่อ เจ้าของ สายพันธุ์ และชิปไอดี');
      return;
    }
    const birthYear = form.birthYear ? Number(form.birthYear) - 543 : null;
    const birth = form.birthDay && form.birthMonth && birthYear
      ? `${birthYear}-${String(form.birthMonth).padStart(2, '0')}-${String(form.birthDay).padStart(2, '0')}`
      : null;
    const petData = { id: form.id.trim(), name: form.name.trim(), ownerCode: form.owner, species: form.species, breed: form.breed.trim(), gender: form.gender, birth };
    try {
      const response = await fetch(modal.type === 'edit' ? `/api/pets/${encodeURIComponent(modal.pet.id)}` : '/api/pets', {
        method: modal.type === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(petData)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'save_failed');
      if (modal.type === 'edit') setPets((current) => current.map((pet) => pet.id === modal.pet.id ? result.pet : pet));
      else setPets((current) => [...current, result.pet]);
      notify(modal.type === 'edit' ? 'แก้ไขข้อมูลสัตว์เลี้ยงแล้ว' : 'เพิ่มสัตว์เลี้ยงใหม่แล้ว');
      setModal(null);
    } catch (error) {
      notify(error.message === 'customer_not_found' ? 'ไม่พบข้อมูลเจ้าของในฐานข้อมูล' : 'บันทึกสัตว์เลี้ยงไม่สำเร็จ');
    }
  }

  async function confirmDelete() {
    try {
      const response = await fetch(`/api/pets/${encodeURIComponent(modal.pet.id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('delete_failed');
      setPets((current) => current.filter((pet) => pet.id !== modal.pet.id));
      notify(`ปิดใช้งานข้อมูล ${modal.pet.name} แล้ว`);
      setModal(null);
    } catch {
      notify('ปิดใช้งานสัตว์เลี้ยงไม่สำเร็จ');
    }
  }

  return <div className="pets-page">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">TC</div><strong>Tle<span>Clinic</span></strong></div>
      <nav>{menuItems.map(([label, href]) => <a className={label === 'สัตว์เลี้ยง' ? 'active' : ''} href={href} key={label}>{label}</a>)}</nav>
    </aside>
    <main className="pets-main">
      <header className="pets-header"><h1>สัตว์เลี้ยง</h1><button className="add-customer-button" onClick={openAddModal}><span>+</span> เพิ่มสัตว์เลี้ยง</button></header>
      {selectedPhotoPet && <section className="profile-photo-manager"><label>โปรไฟล์สัตว์เลี้ยง<select value={photoPetId} onChange={(event) => setPhotoPetId(event.target.value)}>{pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name} · {pet.owner}</option>)}</select></label><ProfilePhotoField key={selectedPhotoPet.id} name={selectedPhotoPet.name} src={selectedPhotoPet.photoUrl} onFileChange={savePetPhoto} /></section>}
      <label className="customer-search"><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อ เบอร์โทร..." /></label>
      <section className="pets-table-wrap"><table className="pets-table"><thead><tr><th>สัตว์เลี้ยง</th><th>เจ้าของ</th><th>ประเภท</th><th>สายพันธุ์</th><th>ชิปไอดี</th><th>เพศ</th><th>วันเกิด</th><th>จัดการ</th></tr></thead><tbody>{filteredPets.map((pet) => <tr key={pet.id}><td><div className="profile-name-cell"><ProfileAvatar src={pet.photoUrl} name={pet.name} />{pet.name}</div></td><td>{pet.owner}</td><td>{pet.species}</td><td>{pet.breed}</td><td className="mono">{pet.id}</td><td><span className={`gender-badge ${pet.gender === 'หญิง' ? 'female' : 'male'}`}>{pet.gender === 'หญิง' ? 'F' : 'M'}</span></td><td>{pet.birth ? displayDate(pet.birth) : '-'}</td><td><div className="customer-row-actions"><button className="edit-action" aria-label={`แก้ไข ${pet.name}`} title="แก้ไข" onClick={() => openEditModal(pet)}><EditIcon /></button><button className="delete-action" aria-label={`ลบ ${pet.name}`} title="ลบ" onClick={() => setModal({ type: 'delete', pet })}><DeleteIcon /></button></div></td></tr>)}</tbody></table>{!loading && filteredPets.length === 0 && <div className="customer-empty">{query ? 'ไม่พบข้อมูลสัตว์เลี้ยง' : 'ยังไม่มีสัตว์เลี้ยงในฐานข้อมูล'}</div>}</section>
      {(modal?.type === 'add' || modal?.type === 'edit') && <div className="customer-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}><form className="customer-modal pet-form-modal" onSubmit={savePet}><button type="button" className="modal-close" aria-label="ปิด" onClick={() => setModal(null)}>×</button><h2>{modal.type === 'edit' ? 'แก้ไข' : 'เพิ่มสัตว์เลี้ยง'}</h2><div className="pet-form-grid"><label>ชื่อ<input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="owner-field">เจ้าของ<div className="owner-combobox"><input value={ownerQuery} onFocus={() => setOwnerMenuOpen(true)} onChange={(event) => { setOwnerQuery(event.target.value); setOwnerMenuOpen(true); }} placeholder="ค้นหาชื่อลูกค้า..." aria-label="ค้นหาเจ้าของ" /><span className="owner-chevron">⌄</span>{ownerMenuOpen && <div className="owner-options">{filteredOwners.length > 0 ? filteredOwners.map((owner) => <button type="button" key={owner.id} onClick={() => { setForm({ ...form, owner: owner.id }); setOwnerQuery(owner.name); setOwnerMenuOpen(false); }}>{owner.name}</button>) : <div className="owner-empty">ไม่พบรายชื่อลูกค้า</div>}</div>}</div></label><label>ประเภทสัตว์<select value={form.species} onChange={(event) => setForm({ ...form, species: event.target.value })}><option>สุนัข</option><option>แมว</option><option>อื่น ๆ</option></select></label><label>สายพันธุ์<input value={form.breed} onChange={(event) => setForm({ ...form, breed: event.target.value })} /></label><label>ชิปไอดี<input value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} /></label><label>เพศ<select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}><option>ชาย</option><option>หญิง</option><option>ไม่ระบุ</option></select></label><label className="birth-field">วันเกิด<div><select aria-label="วันเกิด" value={form.birthDay} onChange={(event) => setForm({ ...form, birthDay: event.target.value })}><option value="">วัน</option>{days.map((day) => <option value={day} key={day}>{day}</option>)}</select><select aria-label="เดือนเกิด" value={form.birthMonth} onChange={(event) => setForm({ ...form, birthMonth: event.target.value })}><option value="">เดือน</option>{months.map((month, index) => <option value={String(index + 1).padStart(2, '0')} key={month}>{month}</option>)}</select><select aria-label="ปีเกิด" value={form.birthYear} onChange={(event) => setForm({ ...form, birthYear: event.target.value })}><option value="">ปี</option>{years.map((year) => <option value={year} key={year}>{year}</option>)}</select></div></label></div><button className="modal-submit pet-submit">{modal.type === 'edit' ? 'บันทึกการแก้ไข' : 'เพิ่มสัตว์เลี้ยง'}</button></form></div>}
    </main>
    {toast && <div className="toast"><b>OK</b>{toast}</div>}
    {modal?.type === 'delete' && <div className="customer-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}><div className="customer-modal delete-modal"><button type="button" className="modal-close" aria-label="ปิด" onClick={() => setModal(null)}>×</button><h2>ยืนยันการลบ</h2><p>ต้องการลบข้อมูล {modal.pet.name} หรือไม่</p><div className="delete-modal-actions"><button type="button" className="modal-submit" onClick={confirmDelete}>ยืนยัน</button><button type="button" className="modal-cancel" onClick={() => setModal(null)}>ยกเลิก</button></div></div></div>}
    {(modal?.type === 'add' || modal?.type === 'edit') && <div className="customer-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}><form className="customer-modal pet-form-modal" onSubmit={savePet}><button type="button" className="modal-close" aria-label="ปิด" onClick={() => setModal(null)}>×</button><h2>{modal.type === 'edit' ? 'แก้ไข' : 'เพิ่มสัตว์เลี้ยง'}</h2><div className="pet-form-grid"><label>ชื่อ<input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="owner-field">เจ้าของ<div className="owner-combobox"><input value={ownerQuery} onFocus={() => setOwnerMenuOpen(true)} onChange={(event) => { setOwnerQuery(event.target.value); setOwnerMenuOpen(true); }} placeholder="ค้นหาเจ้าของ..." aria-label="ค้นหาเจ้าของ" /><span className="owner-chevron">⌄</span>{ownerMenuOpen && <div className="owner-options">{filteredOwners.length > 0 ? filteredOwners.map((owner) => <button type="button" key={owner} onClick={() => { setForm({ ...form, owner }); setOwnerQuery(owner); setOwnerMenuOpen(false); }}>{owner}</button>) : <div className="owner-empty">ไม่พบรายชื่อลูกค้า</div>}</div>}</div></label><label>สายพันธุ์<input value={form.breed} onChange={(event) => setForm({ ...form, breed: event.target.value })} /></label><label>ชิปไอดี<input value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} /></label><label>เพศ<select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}><option>ชาย</option><option>หญิง</option></select></label><label className="birth-field">วันเกิด<div><select aria-label="วันเกิด" value={form.birthDay} onChange={(event) => setForm({ ...form, birthDay: event.target.value })}><option value="">วัน</option>{days.map((day) => <option value={day} key={day}>{day}</option>)}</select><select aria-label="เดือนเกิด" value={form.birthMonth} onChange={(event) => setForm({ ...form, birthMonth: event.target.value })}><option value="">เดือน</option>{months.map((month, index) => <option value={String(index + 1).padStart(2, '0')} key={month}>{month}</option>)}</select><select aria-label="ปีเกิด" value={form.birthYear} onChange={(event) => setForm({ ...form, birthYear: event.target.value })}><option value="">ปี</option>{years.map((year) => <option value={year} key={year}>{year}</option>)}</select></div></label></div><button className="modal-submit pet-submit" type="submit">{modal.type === 'edit' ? 'แก้ไข' : 'เพิ่ม'}</button></form></div>}
  </div>;
}
