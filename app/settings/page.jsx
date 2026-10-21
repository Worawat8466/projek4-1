'use client';

import { useEffect, useRef, useState } from 'react';
import { defaultSettings, themes } from '../../src/appSettings.js';

const menuItems = [
  ['Dashboard', '/dashboard'], ['หน้าร้าน', '/'], ['ลูกค้า', '/customers'], ['สัตว์เลี้ยง', '/pets'],
  ['สินค้า', '/products'], ['คลังสินค้า', '/inventory'], ['สั่งซื้อสินค้า', '/purchase-orders'],
  ['ผู้จัดจำหน่าย', '/suppliers'], ['สรุปยอดขาย', '/sales-reports'], ['จัดการพนักงาน', '/employees'], ['ตั้งค่า', '/settings']
];

export default function SettingsPage() {
  const [settings, setSettings] = useState(defaultSettings);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState('');
  const [loadError, setLoadError] = useState('');
  const importInput = useRef(null);

  useEffect(() => {
    let active = true;
    fetch('/api/settings')
      .then((response) => {
        if (!response.ok) throw new Error('settings_load_failed');
        return response.json();
      })
      .then((data) => {
        if (active) setSettings(data.settings);
      })
      .catch(() => { if (active) setLoadError('โหลดการตั้งค่าจากฐานข้อมูลไม่สำเร็จ'); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  }

  function updateSetting(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  function updatePaymentMethod(key, value) {
    setSettings((current) => ({ ...current, paymentMethods: { ...current.paymentMethods, [key]: value } }));
    setDirty(true);
  }

  async function saveCurrentSettings() {
    if (!settings.paymentMethods.cash && !settings.paymentMethods.promptpay) {
      notify('ต้องเปิดช่องทางชำระเงินอย่างน้อยหนึ่งช่องทาง');
      return;
    }
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (!response.ok) throw new Error('settings_save_failed');
      setDirty(false);
      setLoadError('');
      window.dispatchEvent(new Event('clinic-settings-updated'));
      notify('บันทึกการตั้งค่าในฐานข้อมูลแล้ว');
    } catch {
      notify('บันทึกไม่สำเร็จ กรุณาตรวจการเชื่อมต่อฐานข้อมูล');
    }
  }

  function exportSettings() {
    const backup = { format: 'tleclinic-settings', version: 1, exportedAt: new Date().toISOString(), settings };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tleclinic-settings.json';
    link.click();
    URL.revokeObjectURL(url);
    notify('ส่งออกไฟล์ตั้งค่าแล้ว');
  }

  async function importSettings(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const backup = JSON.parse(await file.text());
      if (backup.format !== 'tleclinic-settings' || backup.version !== 1 || !backup.settings || typeof backup.settings !== 'object') {
        throw new Error('Invalid settings backup');
      }
      const importedSettings = { ...defaultSettings, ...backup.settings };
      if (!importedSettings.paymentMethods || typeof importedSettings.paymentMethods !== 'object') {
        throw new Error('Invalid payment settings');
      }
      setSettings(importedSettings);
      setDirty(true);
      notify('นำเข้าค่าแล้ว กดบันทึกเพื่อเขียนลงฐานข้อมูล');
    } catch {
      notify('ไฟล์ไม่ถูกต้อง หรือไม่ใช่ไฟล์ตั้งค่า TleClinic');
    } finally {
      event.target.value = '';
    }
  }

  return <div className="settings-page" style={{ '--theme-accent': themes.find((theme) => theme.id === settings.themeId)?.color || themes[0].color }}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">TC</div><strong>Tle<span>Clinic</span></strong></div>
      <nav>{menuItems.map(([label, href]) => <a className={label === 'ตั้งค่า' ? 'active' : ''} href={href} key={label}>{label}</a>)}</nav>
    </aside>

    <main className="settings-main">
      <header className="settings-header">
        <div><p>WORKSPACE SETTINGS</p><h1>ตั้งค่า</h1><span>ปรับข้อมูลและรูปแบบการทำงานของคลินิก</span></div>
        <div className="settings-save-group">
          <span className={`settings-save-status ${dirty ? 'unsaved' : ''}`}>{dirty ? 'มีการเปลี่ยนแปลงที่ยังไม่บันทึก' : 'บันทึกแล้ว'}</span>
          <button className="settings-save" type="button" onClick={saveCurrentSettings} disabled={!ready || !dirty}>บันทึกการเปลี่ยนแปลง</button>
        </div>
      </header>
      {loadError && <p role="alert">{loadError}</p>}

      <div className="settings-grid">
        <section className="settings-section">
          <div className="settings-section-heading"><h2>ข้อมูลร้าน</h2><span>แสดงบนใบเสร็จและเอกสาร</span></div>
          <div className="settings-form-grid">
            <label>ชื่อคลินิก<input value={settings.clinicName} onChange={(event) => updateSetting('clinicName', event.target.value)} /></label>
            <label>เบอร์โทรศัพท์<input type="tel" value={settings.phone} onChange={(event) => updateSetting('phone', event.target.value)} /></label>
            <label className="wide">ที่อยู่<textarea value={settings.address} onChange={(event) => updateSetting('address', event.target.value)} /></label>
            <label>เลขประจำตัวผู้เสียภาษี<input value={settings.taxId} onChange={(event) => updateSetting('taxId', event.target.value)} placeholder="ระบุเลขผู้เสียภาษี" /></label>
            <label>ข้อความท้ายใบเสร็จ<input value={settings.receiptFooter} onChange={(event) => updateSetting('receiptFooter', event.target.value)} /></label>
          </div>
          <div className="theme-picker">
            <div><b>โทนสีหลักของธีม</b><span>เปลี่ยนสีเมนูและจุดเน้นของระบบ</span></div>
            <div className="theme-options">{themes.map((theme) => <button className={settings.themeId === theme.id ? 'selected' : ''} type="button" onClick={() => updateSetting('themeId', theme.id)} key={theme.id} aria-pressed={settings.themeId === theme.id}><i style={{ background: theme.color }} /><span>{theme.name}</span></button>)}</div>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-heading"><h2>การขายและใบเสร็จ</h2><span>ใช้กับการคิดเงินหน้าร้าน</span></div>
          <div className="settings-form-grid">
            <label>คำนำหน้าเลขบิล<input value={settings.receiptPrefix} onChange={(event) => updateSetting('receiptPrefix', event.target.value)} /></label>
            <label>อัตราภาษี VAT (%)<input type="number" min="0" max="100" step="0.01" value={settings.vatRate} onChange={(event) => updateSetting('vatRate', Math.min(100, Math.max(0, Number(event.target.value))))} /></label>
            <label>ส่วนลดเริ่มต้น (บาท)<input type="number" min="0" step="1" value={settings.defaultDiscount} onChange={(event) => updateSetting('defaultDiscount', Math.max(0, Number(event.target.value)))} /></label>
            <label>รูปแบบการพิมพ์<select value={settings.printFormat} onChange={(event) => updateSetting('printFormat', event.target.value)}><option>ใบเสร็จขนาดเล็ก</option><option>A4</option></select></label>
          </div>
          <div className="settings-toggles">
            <label><span><b>คิดภาษี VAT</b><small>คำนวณ VAT เพิ่มจากยอดหลังหักส่วนลด</small></span><input type="checkbox" checked={settings.vatEnabled} onChange={(event) => updateSetting('vatEnabled', event.target.checked)} /></label>
            <label><span><b>เงินสด</b><small>เปิดรับชำระด้วยเงินสด</small></span><input type="checkbox" checked={settings.paymentMethods.cash} onChange={(event) => updatePaymentMethod('cash', event.target.checked)} /></label>
            <label><span><b>พร้อมเพย์</b><small>เปิดรับชำระด้วย QR พร้อมเพย์</small></span><input type="checkbox" checked={settings.paymentMethods.promptpay} onChange={(event) => updatePaymentMethod('promptpay', event.target.checked)} /></label>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-heading"><h2>คลังสินค้า</h2><span>การแจ้งเตือนสินค้า</span></div>
          <div className="settings-toggles">
            <label><span><b>แจ้งเตือนสต็อกต่ำ</b><small>แจ้งเมื่อจำนวนสินค้าต่ำกว่าที่กำหนด</small></span><input type="checkbox" checked={settings.lowStockAlerts} onChange={(event) => updateSetting('lowStockAlerts', event.target.checked)} /></label>
            <label><span><b>แจ้งเตือนสินค้าใกล้หมดอายุ</b><small>แจ้งก่อนวันหมดอายุตามจำนวนวันที่กำหนด</small></span><input type="checkbox" checked={settings.expiryAlerts} onChange={(event) => updateSetting('expiryAlerts', event.target.checked)} /></label>
          </div>
          <div className="settings-form-grid compact">
            <label>จำนวนเตือนเริ่มต้น<input type="number" min="0" step="1" value={settings.lowStockThreshold} onChange={(event) => updateSetting('lowStockThreshold', Math.max(0, Number(event.target.value)))} /></label>
            <label>แจ้งเตือนก่อนหมดอายุ (วัน)<input type="number" min="0" step="1" value={settings.expiryAlertDays} onChange={(event) => updateSetting('expiryAlertDays', Math.max(0, Number(event.target.value)))} /></label>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-heading"><h2>ความปลอดภัยและข้อมูล</h2><span>สำรองและกู้คืนการตั้งค่า</span></div>
          <div className="settings-actions">
            <button type="button" disabled title="ยังไม่เชื่อมระบบบัญชีผู้ใช้">เปลี่ยน Master Password</button>
            <button type="button" disabled title="ยังไม่เชื่อมระบบบัญชีผู้ใช้">เปลี่ยน PIN ล็อกหน้าจอ</button>
            <button type="button" disabled title="ยังไม่เชื่อมระบบบัญชีผู้ใช้">Recovery Code</button>
            <button type="button" onClick={exportSettings}>Export ตั้งค่า</button>
            <button type="button" onClick={() => importInput.current?.click()}>Import ตั้งค่า</button>
            <input ref={importInput} className="settings-import-input" type="file" accept="application/json,.json" onChange={importSettings} />
          </div>
          <p className="settings-note">การตั้งค่าคลินิกบันทึกใน Oracle Database · Export/Import ครอบคลุมเฉพาะการตั้งค่าคลินิก · ระบบรหัสผ่านและ PIN ยังไม่เชื่อมต่อ</p>
        </section>
      </div>
    </main>
    {toast && <div className="toast" role="status"><b>OK</b>{toast}</div>}
  </div>;
}
