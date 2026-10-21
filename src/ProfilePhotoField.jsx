'use client';

import { useEffect, useState } from 'react';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxBytes = 5 * 1024 * 1024;

export function ProfileAvatar({ src, name, className = '' }) {
  return <span className={`profile-avatar ${className}`} aria-label={name || 'รูปโปรไฟล์'}>
    {src ? <img src={src} alt={name ? `รูปโปรไฟล์ ${name}` : 'รูปโปรไฟล์'} /> : <span aria-hidden="true">{name?.trim()?.slice(0, 1) || '-'}</span>}
  </span>;
}

export async function uploadProfilePhoto(entity, identifier, file) {
  const formData = new FormData();
  formData.append('file', file);
  const url = `/api/profile-images/${entity}/${encodeURIComponent(identifier)}`;
  const response = await fetch(url, { method: 'PUT', body: formData });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'image_upload_failed');
  return `${url}?v=${Date.now()}`;
}

export default function ProfilePhotoField({ name, src, onFileChange }) {
  const [preview, setPreview] = useState(src || '');
  const [error, setError] = useState('');

  useEffect(() => {
    setPreview(src || '');
  }, [src]);

  useEffect(() => () => {
    if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
  }, [preview]);

  function selectFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!allowedTypes.has(file.type) || file.size > maxBytes) {
      setError(file.size > maxBytes ? 'รูปต้องมีขนาดไม่เกิน 5 MB' : 'รองรับไฟล์ JPEG, PNG หรือ WebP');
      onFileChange(null);
      event.target.value = '';
      return;
    }
    setError('');
    setPreview(URL.createObjectURL(file));
    onFileChange(file);
  }

  return <div className="profile-photo-field">
    <ProfileAvatar src={preview} name={name} className="profile-avatar-preview" />
    <label className="profile-photo-control">รูปโปรไฟล์<input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectFile} /></label>
    {error && <small className="profile-photo-error" role="alert">{error}</small>}
  </div>;
}