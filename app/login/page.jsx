'use client';

import { useEffect, useState } from 'react';
import { createRecoveryCode, createSalt, hashSecret, readLocalAuth, saveLocalAuth } from '../../src/localAuth.js';

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
    setMode(readLocalAuth() ? 'login' : 'setup');
    setReady(true);
  }, []);

  function showError(text) {
    setMessage(text);
  }

  async function handleLogin(event) {
    event.preventDefault();
    const auth = readLocalAuth();
    if (!auth) {
      setMessage('ยังไม่ได้ตั้งค่าเครื่องนี้ กรุณาตั้งค่าก่อนเข้าใช้งาน');
      setMode('setup');
      return;
    }
    if (!username.trim() || !password) {
      showError('กรุณากรอก Username และ Password');
      return;
    }
    try {
      const passwordHash = await hashSecret(password, auth.salt);
      if (username.trim() !== auth.username || passwordHash !== auth.passwordHash) {
        showError('Username หรือ Password ไม่ถูกต้อง');
        return;
      }
      window.location.href = '/';
    } catch {
      showError('ตรวจสอบรหัสผ่านไม่สำเร็จ');
    }
  }

  async function handleSetup(event) {
    event.preventDefault();
    if (!username.trim() || password.length < 8 || !/^\d{4,6}$/.test(pin)) {
      showError('กรอก Username, Password อย่างน้อย 8 ตัวอักษร และ PIN 4-6 หลัก');
      return;
    }

    try {
      const salt = createSalt();
      const code = createRecoveryCode();
      const auth = {
        username: username.trim(),
        salt,
        passwordHash: await hashSecret(password, salt),
        pinHash: await hashSecret(pin, salt),
        recoveryCodeHash: await hashSecret(code, salt),
        createdAt: new Date().toISOString()
      };
      if (!saveLocalAuth(auth)) throw new Error('Storage unavailable');
      setGeneratedCode(code);
      setMessage('');
      setMode('recovery-code');
    } catch {
      showError('ตั้งค่าไม่สำเร็จ กรุณาลองอีกครั้ง');
    }
  }

  async function handleRecovery(event) {
    event.preventDefault();
    const auth = readLocalAuth();
    if (!auth?.recoveryCodeHash) {
      showError('Recovery Code ถูกใช้แล้วหรือไม่มีอยู่ กรุณาติดต่อผู้ดูแลระบบ');
      return;
    }
    if (newPassword.length < 8 || !/^\d{4,6}$/.test(newPin)) {
      showError('รหัสผ่านใหม่ต้องอย่างน้อย 8 ตัวอักษร และ PIN ใหม่ 4-6 หลัก');
      return;
    }

    try {
      const suppliedHash = await hashSecret(recoveryCode.trim().toUpperCase(), auth.salt);
      if (suppliedHash !== auth.recoveryCodeHash) {
        showError('Recovery Code ไม่ถูกต้อง');
        return;
      }
      const updatedAuth = {
        ...auth,
        passwordHash: await hashSecret(newPassword, auth.salt),
        pinHash: await hashSecret(newPin, auth.salt),
        recoveryCodeHash: null,
        recoveryUsedAt: new Date().toISOString()
      };
      if (!saveLocalAuth(updatedAuth)) throw new Error('Storage unavailable');
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
          <Field autoFocus label="Username" value={username} onChange={setUsername} placeholder="ชื่อผู้ใช้งาน" />
          <Field label="Master Password" type="password" value={password} onChange={setPassword} placeholder="อย่างน้อย 8 ตัวอักษร" />
          <Field label="PIN ล็อกหน้าจอ" type="password" inputMode="numeric" value={pin} onChange={(value) => setPin(value.replace(/\D/g, '').slice(0, 6))} placeholder="PIN 4-6 หลัก" />
          {message && <p className="login-error" role="alert">{message}</p>}
          <button className="login-submit" type="submit">บันทึกและสร้าง Recovery Code</button>
        </form>
      </>}

      {mode === 'login' && <>
        <div className="login-heading"><p>WELCOME BACK</p><h1>เข้าสู่ระบบ</h1><span>ลงชื่อเข้าใช้ TleClinic POS</span></div>
        <form className="login-form" onSubmit={handleLogin}>
          <Field autoFocus label="Username" value={username} onChange={setUsername} placeholder="กรอก Username" />
          <Field label="Master Password" type="password" value={password} onChange={setPassword} placeholder="กรอก Password" />
          {message && <p className="login-error" role="status">{message}</p>}
          <button className="login-submit" type="submit">เข้าสู่ระบบ</button>
        </form>
        <button className="forgot-password" type="button" onClick={() => { setMessage(''); setMode('recover'); }}>กู้คืนด้วย Recovery Code</button>
      </>}

      {mode === 'recover' && <>
        <div className="login-heading"><p>OFFLINE RECOVERY</p><h1>กู้คืนบัญชี</h1><span>ใช้ Recovery Code ที่บันทึกไว้นอกเครื่อง ระบบจะใช้ code นี้ได้ครั้งเดียว</span></div>
        <form className="login-form" onSubmit={handleRecovery}>
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
      <p className="login-footer">TleClinic POS <span>•</span> รหัสกู้คืนจัดเก็บเป็น hash ในเครื่องนี้</p>
    </section>
  </main>;
}
