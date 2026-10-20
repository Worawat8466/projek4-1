'use client';

import { useState } from 'react';

function Field({ label, type = 'text', value, onChange, placeholder, autoFocus = false }) {
  return <label className="auth-field">{label}<input autoFocus={autoFocus} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');

  function showError(text) { setMessage(text); }

  function handleLogin(event) {
    event.preventDefault();
    if (!username.trim() || !password) {
      showError('กรุณากรอก Username และ Password');
      return;
    }
    window.location.href = '/';
  }

  function handleSetup(event) {
    event.preventDefault();
    if (!username.trim() || password.length < 6 || !/^\d{4,6}$/.test(pin)) {
      showError('กรอก Username, Password อย่างน้อย 6 ตัวอักษร และ PIN 4-6 หลัก');
      return;
    }
    setGeneratedCode('TLC-XXXX-XXXX-XXXX');
    setMessage('');
    setMode('recovery-code');
  }

  function handleRecovery(event) {
    event.preventDefault();
    if (newPassword.length < 6) {
      showError('รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }
    setMessage('ตั้งรหัสผ่านใหม่สำเร็จ (ตัวอย่าง UI)');
    setMode('login');
    setPassword('');
    setNewPassword('');
    setRecoveryCode('');
  }

  return <main className="login-page">
    <div className="login-glow login-glow-one" /><div className="login-glow login-glow-two" />
    <section className="login-card">
      <div className="login-brand"><div className="login-brand-mark">TC</div><strong>Tle<span>Clinic</span></strong></div>
      {mode === 'setup' && <><div className="login-heading"><p>FIRST-TIME SETUP</p><h1>ตั้งค่าเครื่องร้าน</h1><span>ตั้งค่าหนึ่งครั้ง แล้วเปิดใช้หน้าร้านได้ทันทีทุกวัน</span></div><form className="login-form" onSubmit={handleSetup}><Field autoFocus label="Username" value={username} onChange={setUsername} placeholder="ชื่อผู้ใช้งาน" /><Field label="Master Password" type="password" value={password} onChange={setPassword} placeholder="อย่างน้อย 6 ตัวอักษร" /><Field label="PIN ล็อกหน้าจอ" type="password" value={pin} onChange={(value) => setPin(value.replace(/\D/g, '').slice(0, 6))} placeholder="PIN 4-6 หลัก" />{message && <p className="login-error">{message}</p>}<button className="login-submit">บันทึกและเริ่มใช้งาน</button></form></>}
      {mode === 'login' && <><div className="login-heading"><p>WELCOME BACK</p><h1>เข้าสู่ระบบ</h1><span>เปิดร้านและเริ่มขายได้ทันที</span></div><form className="login-form" onSubmit={handleLogin}><Field autoFocus label="Username" value={username} onChange={setUsername} placeholder="กรอก Username" /><Field label="Master Password" type="password" value={password} onChange={setPassword} placeholder="กรอก Password" />{message && <p className="login-error">{message}</p>}<button className="login-submit">เข้าสู่ระบบ</button></form><button className="forgot-password" onClick={() => { setMessage(''); setMode('recover'); }}>ลืมรหัสผ่าน?</button><button className="setup-demo-link" onClick={() => { setMessage(''); setMode('setup'); }}>ตั้งค่าเครื่อง (Demo)</button></>}
      {mode === 'recover' && <><div className="login-heading"><p>OFFLINE RECOVERY</p><h1>กู้รหัสผ่าน</h1><span>ใช้ Recovery Code ที่บันทึกไว้ตอนตั้งค่าเครื่อง</span></div><form className="login-form" onSubmit={handleRecovery}><Field autoFocus label="Recovery Code" value={recoveryCode} onChange={(value) => setRecoveryCode(value.toUpperCase())} placeholder="TLC-XXXX-XXXX-XXXX" /><Field label="Master Password ใหม่" type="password" value={newPassword} onChange={setNewPassword} placeholder="อย่างน้อย 6 ตัวอักษร" />{message && <p className="login-error">{message}</p>}<button className="login-submit">ตั้งรหัสผ่านใหม่</button></form><button className="forgot-password" onClick={() => { setMessage(''); setMode('login'); }}>กลับไปเข้าสู่ระบบ</button></>}
      {mode === 'recovery-code' && <div className="recovery-code-view"><div className="login-heading"><p>IMPORTANT</p><h1>เก็บรหัสกู้คืน</h1><span>จดหรือพิมพ์รหัสนี้เก็บไว้นอกเครื่อง รหัสจะแสดงเพียงครั้งเดียว</span></div><code>{generatedCode}</code><button className="login-submit" onClick={() => { setGeneratedCode(''); window.location.href = '/'; }}>ฉันบันทึกรหัสแล้ว</button></div>}
      <p className="login-footer">TleClinic POS <span>•</span> โหมดใช้งานเครื่องเดียว</p>
    </section>
  </main>;
}
