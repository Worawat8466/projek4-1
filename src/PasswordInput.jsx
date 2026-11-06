'use client';

import { useState } from 'react';

export default function PasswordInput({ type = 'password', ...inputProps }) {
  const [visible, setVisible] = useState(false);
  return <span className="password-visibility-field">
    <input {...inputProps} type={visible ? 'text' : type} />
    <button className="password-visibility-toggle" type="button" aria-label={visible ? 'ซ่อนรหัส' : 'แสดงรหัส'} aria-pressed={visible} onClick={() => setVisible((current) => !current)}>
      {visible
        ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c6.5 0 9.5 7 9.5 7a15 15 0 0 1-3.1 3.9M6.2 6.2C3.7 8 2.5 12 2.5 12s3 7 9.5 7c1 0 1.9-.2 2.7-.5" /></svg>
        : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" /><circle cx="12" cy="12" r="2.5" /></svg>}
    </button>
  </span>;
}
