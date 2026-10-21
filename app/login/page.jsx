'use client';

import { useEffect, useState } from 'react';
function Field({ label, type = 'text', value, onChange, placeholder, autoFocus = false, inputMode }) {
  return <label className="auth-field">{label}<input autoFocus={autoFocus} inputMode={inputMode} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [message, setMessage] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');

  useEffect(() => {
    fetch('/api/auth')
      .then((response) => {
        if (!response.ok) throw new Error('database_unavailable');
        return response.json();
      })
      .then((status) => setMode(status.needsSetup ? 'setup' : 'login'))
      .catch(() => setMessage('เชื่อมต่อฐานข้อมูลไม่ได้'))
      .finally(() => setReady(true));
  }, []);

  function showError(text) {
    setMessage(text);
  }

  async function handleLogin(event) {
    event.preventDefault();
    if (!username.trim() || !password) {
      showError('กรุณากรอก Username และ Password');
      return;
    }
    try {
      const response = await fetch('/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email: username.trim(), password })
      });
      if (!response.ok) throw new Error('invalid_credentials');
      window.location.href = '/';
    } catch (error) {
      showError(error.message === 'invalid_credentials' ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : 'ตรวจสอบบัญชีไม่สำเร็จ');
    }
  }

  async function handleSetup(event) {
    event.preventDefault();
    if (!username.trim() || password.length < 8 || !/^\d{4,6}$/.test(pin)) {
      showError('กรอก Username, Password อย่างน้อย 8 ตัวอักษร และ PIN 4-6 หลัก');
      return;
    }

    try {
      const response = await fetch('/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup', email: username.trim(), password, pin })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'setup_failed');
      setGeneratedCode(result.recoveryCode);
      setMessage('');
      setMode('recovery-code');
    } catch (error) {
      showError(error.message === 'setup_complete' ? 'มีบัญชีผู้ดูแลอยู่แล้ว กรุณาเข้าสู่ระบบ' : 'ตั้งค่าไม่สำเร็จ กรุณาตรวจอีเมลและการเชื่อมต่อฐานข้อมูล');
    }
  }

  async function handleRecovery(event) {
    event.preventDefault();
    if (newPassword.length < 8 || !/^\d{4,6}$/.test(newPin)) {
      showError('รหัสผ่านใหม่ต้องอย่างน้อย 8 ตัวอักษร และ PIN ใหม่ 4-6 หลัก');
      return;
    }

    try {
      const response = await fetch('/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recover', email: username.trim(), recoveryCode, password: newPassword, pin: newPin })
      });
      if (!response.ok) throw new Error('recovery_failed');
      setMessage('เปลี่ยน Password และ PIN แล้ว กรุณาเข้าสู่ระบบด้วยค่าใหม่');
      setMode('login');
      setPassword('');
      setNewPassword('');
      setNewPin('');
      setRecoveryCode('');
    } catch {
      showError('กู้คืนไม่สำเร็จ กรุณาลองอีกครั้ง');
    }
  }

  if (!ready) return <main className="login-page"><section className="login-card" aria-busy="true" /></main>;

  return <main className="login-page">
    <section className="login-card">
      <div className="login-brand"><div className="login-brand-mark">TC</div><strong>Tle<span>Clinic</span></strong></div>

      {mode === 'setup' && <>
        <div className="login-heading"><p>FIRST-TIME SETUP</p><h1>ตั้งค่าเครื่องร้าน</h1><span>สร้างบัญชีผู้ดูแลและตั้ง PIN สำหรับเครื่องนี้</span></div>
        <form className="login-form" onSubmit={handleSetup}>
          <Field autoFocus label="อีเมลผู้ดูแล" value={username} onChange={setUsername} placeholder="admin@example.com" />
          <Field label="Master Password" type="password" value={password} onChange={setPassword} placeholder="อย่างน้อย 8 ตัวอักษร" />
          <Field label="PIN ล็อกหน้าจอ" type="password" inputMode="numeric" value={pin} onChange={(value) => setPin(value.replace(/\D/g, '').slice(0, 6))} placeholder="PIN 4-6 หลัก" />
          {message && <p className="login-error" role="alert">{message}</p>}
          <button className="login-submit" type="submit">บันทึกและสร้าง Recovery Code</button>
        </form>
      </>}

      {mode === 'login' && <>
        <div className="login-heading"><p>WELCOME BACK</p><h1>เข้าสู่ระบบ</h1><span>ลงชื่อเข้าใช้ TleClinic POS</span></div>
        <form className="login-form" onSubmit={handleLogin}>
          <Field autoFocus label="อีเมล" value={username} onChange={setUsername} placeholder="กรอกอีเมล" />
          <Field label="Master Password" type="password" value={password} onChange={setPassword} placeholder="กรอก Password" />
          {message && <p className="login-error" role="status">{message}</p>}
          <button className="login-submit" type="submit">เข้าสู่ระบบ</button>
        </form>
        <button className="forgot-password" type="button" onClick={() => { setMessage(''); setMode('recover'); }}>กู้คืนด้วย Recovery Code</button>
      </>}

      {mode === 'recover' && <>
        <div className="login-heading"><p>ACCOUNT RECOVERY</p><h1>กู้คืนบัญชี</h1><span>Recovery Code ใช้ได้ครั้งเดียว</span></div>
        <form className="login-form" onSubmit={handleRecovery}>
          <Field autoFocus label="อีเมล" value={username} onChange={setUsername} placeholder="อีเมลผู้ดูแล" />
          <Field autoFocus label="Recovery Code" value={recoveryCode} onChange={(value) => setRecoveryCode(value.toUpperCase())} placeholder="TLC-XXXX-XXXX-XXXX" />
          <Field label="Master Password ใหม่" type="password" value={newPassword} onChange={setNewPassword} placeholder="อย่างน้อย 8 ตัวอักษร" />
          <Field label="PIN ใหม่" type="password" inputMode="numeric" value={newPin} onChange={(value) => setNewPin(value.replace(/\D/g, '').slice(0, 6))} placeholder="PIN 4-6 หลัก" />
          {message && <p className="login-error" role="alert">{message}</p>}
          <button className="login-submit" type="submit">เปลี่ยน Password และ PIN</button>
        </form>
        <button className="forgot-password" type="button" onClick={() => { setMessage(''); setMode('login'); }}>กลับไปเข้าสู่ระบบ</button>
      </>}

      {mode === 'recovery-code' && <div className="recovery-code-view">
        <div className="login-heading"><p>IMPORTANT · แสดงครั้งเดียว</p><h1>บันทึกรหัสกู้คืน</h1><span>จดหรือพิมพ์รหัสนี้เก็บไว้นอกเครื่อง ปิดหน้านี้แล้วจะเรียกดูรหัสเดิมไม่ได้</span></div>
        <code>{generatedCode}</code>
        <button className="login-submit" type="button" onClick={() => { setGeneratedCode(''); window.location.href = '/'; }}>ฉันบันทึกรหัสแล้ว</button>
      </div>}
      <p className="login-footer">TleClinic POS <span>•</span> บัญชีและ session จัดเก็บในฐานข้อมูลคลินิก</p>
    </section>
  </main>;
}
