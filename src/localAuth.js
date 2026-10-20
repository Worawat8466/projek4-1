export const LOCAL_AUTH_STORAGE_KEY = 'tleclinic.local-auth.v1';

const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value) {
  return new Uint8Array(value.match(/.{2}/g).map((part) => Number.parseInt(part, 16)));
}

export function createSalt() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
}

export function createRecoveryCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const characters = Array.from(bytes, (byte) => RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length]);
  return `TLC-${characters.slice(0, 4).join('')}-${characters.slice(4, 8).join('')}-${characters.slice(8, 12).join('')}`;
}

export async function hashSecret(secret, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt: hexToBytes(salt),
    iterations: 120000,
    hash: 'SHA-256'
  }, keyMaterial, 256);
  return bytesToHex(new Uint8Array(hash));
}

export function readLocalAuth() {
  try {
    const stored = localStorage.getItem(LOCAL_AUTH_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function saveLocalAuth(auth) {
  try {
    localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(auth));
    return true;
  } catch {
    return false;
  }
}
