import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import oracledb from 'oracledb';
import { withOracleConnection, withOracleTransaction } from './oraclePool.js';

const scryptAsync = promisify(scrypt);
const sessionLifetimeMs = 12 * 60 * 60 * 1000;
const objectRows = { outFormat: oracledb.OUT_FORMAT_OBJECT };

async function hashSecret(secret) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(secret, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

async function verifySecret(secret, encodedHash) {
  if (!encodedHash) return false;
  const [saltHex, hashHex] = encodedHash.split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scryptAsync(secret, Buffer.from(saltHex, 'hex'), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function makeRecoveryCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(12);
  const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]);
  return `TLC-${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8).join('')}`;
}

async function createSession(connection, staffId) {
  const token = randomBytes(32).toString('hex');
  await connection.execute(
    `INSERT INTO auth_sessions (staff_id, token_hash, expires_at)
     VALUES (:staffId, :tokenHash, :expiresAt)`,
    { staffId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + sessionLifetimeMs) }
  );
  return token;
}

export async function getAuthStatus() {
  return withOracleConnection(async (connection) => {
    const result = await connection.execute(
      `SELECT COUNT(*) AS ADMIN_COUNT FROM staff s JOIN staff_roles r ON r.role_id = s.role_id
        WHERE r.role_code = 'ADMIN' AND s.is_active = 'Y' AND s.password_hash IS NOT NULL`,
      [], objectRows
    );
    return { needsSetup: Number(result.rows[0].ADMIN_COUNT) === 0 };
  });
}

export async function setupAdmin(input) {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashSecret(input.password);
  const pinHash = await hashSecret(input.pin);
  const recoveryCode = makeRecoveryCode();
  const recoveryCodeHash = await hashSecret(recoveryCode);
  return withOracleTransaction(async (connection) => {
    const roleResult = await connection.execute(
      `SELECT role_id FROM staff_roles WHERE role_code = 'ADMIN' AND is_system = 'Y' FOR UPDATE`,
      [], objectRows
    );
    if (!roleResult.rows[0]) throw Object.assign(new Error('admin_role_missing'), { code: 'AUTH_NOT_CONFIGURED' });
    const existing = await connection.execute(
      `SELECT COUNT(*) AS ADMIN_COUNT FROM staff s JOIN staff_roles r ON r.role_id = s.role_id
        WHERE r.role_code = 'ADMIN' AND s.password_hash IS NOT NULL`,
      [], objectRows
    );
    if (Number(existing.rows[0].ADMIN_COUNT) > 0) {
      throw Object.assign(new Error('setup_already_complete'), { code: 'SETUP_COMPLETE' });
    }
    const staffBinds = {
      roleId: roleResult.rows[0].ROLE_ID,
      firstName: input.firstName?.trim() || email.split('@')[0],
      lastName: input.lastName?.trim() || 'Admin',
      email,
      passwordHash,
      pinHash,
      recoveryCodeHash
    };
    console.log('[auth-setup-binds]', {
      roleIdPresent: staffBinds.roleId != null,
      firstNamePresent: Boolean(staffBinds.firstName),
      lastNamePresent: Boolean(staffBinds.lastName),
      lastNameType: typeof staffBinds.lastName
    });
    await connection.execute(
      `INSERT INTO staff (role_id, first_name, last_name, email, password_hash, pin_hash, recovery_code_hash)
       VALUES (:roleId, :firstName, :lastName, :email, :passwordHash, :pinHash, :recoveryCodeHash)`,
      staffBinds
    );
    const staffResult = await connection.execute(
      'SELECT staff_id FROM staff WHERE email = :email', { email }, objectRows
    );
    const token = await createSession(connection, staffResult.rows[0].STAFF_ID);
    return { token, recoveryCode };
  });
}

export async function loginStaff(input) {
  const email = input.email.trim().toLowerCase();
  return withOracleTransaction(async (connection) => {
    const result = await connection.execute(
      `SELECT staff_id, password_hash FROM staff
        WHERE LOWER(email) = :email AND is_active = 'Y'`,
      { email }, objectRows
    );
    const staff = result.rows[0];
    if (!staff || !(await verifySecret(input.password, staff.PASSWORD_HASH))) {
      throw Object.assign(new Error('invalid_credentials'), { code: 'INVALID_CREDENTIALS' });
    }
    await connection.execute(
      'UPDATE staff SET last_login_at = SYSTIMESTAMP WHERE staff_id = :staffId',
      { staffId: staff.STAFF_ID }
    );
    const token = await createSession(connection, staff.STAFF_ID);
    return { token };
  });
}

export async function recoverStaffAccount(input) {
  const email = input.email.trim().toLowerCase();
  const suppliedCode = input.recoveryCode.trim().toUpperCase();
  const passwordHash = await hashSecret(input.password);
  const pinHash = await hashSecret(input.pin);
  return withOracleTransaction(async (connection) => {
    const result = await connection.execute(
      `SELECT staff_id, recovery_code_hash FROM staff
        WHERE LOWER(email) = :email AND is_active = 'Y' FOR UPDATE`,
      { email }, objectRows
    );
    const staff = result.rows[0];
    if (!staff || !(await verifySecret(suppliedCode, staff.RECOVERY_CODE_HASH))) {
      throw Object.assign(new Error('invalid_recovery_code'), { code: 'INVALID_RECOVERY_CODE' });
    }
    await connection.execute(
      `UPDATE staff SET password_hash = :passwordHash, pin_hash = :pinHash,
              recovery_code_hash = NULL, recovery_used_at = SYSTIMESTAMP, updated_at = SYSTIMESTAMP
        WHERE staff_id = :staffId`,
      { passwordHash, pinHash, staffId: staff.STAFF_ID }
    );
    await connection.execute('DELETE FROM auth_sessions WHERE staff_id = :staffId', { staffId: staff.STAFF_ID });
  });
}

export async function validateSession(token) {
  if (!token) return false;
  return withOracleConnection(async (connection) => {
    const result = await connection.execute(
      `SELECT COUNT(*) AS SESSION_COUNT FROM auth_sessions a
         JOIN staff s ON s.staff_id = a.staff_id
        WHERE a.token_hash = :tokenHash AND a.expires_at > SYSTIMESTAMP AND s.is_active = 'Y'`,
      { tokenHash: hashToken(token) }, objectRows
    );
    return Number(result.rows[0].SESSION_COUNT) > 0;
  });
}

export async function getSessionStaffId(token) {
  if (!token) return null;
  return withOracleConnection(async (connection) => {
    const result = await connection.execute(
      `SELECT s.staff_id FROM auth_sessions a
         JOIN staff s ON s.staff_id = a.staff_id
        WHERE a.token_hash = :tokenHash AND a.expires_at > SYSTIMESTAMP AND s.is_active = 'Y'`,
      { tokenHash: hashToken(token) }, objectRows
    );
    return result.rows[0] ? Number(result.rows[0].STAFF_ID) : null;
  });
}

export async function verifyStaffPin(token, pin) {
  if (!token) return false;
  return withOracleConnection(async (connection) => {
    const result = await connection.execute(
      `SELECT s.pin_hash FROM auth_sessions a JOIN staff s ON s.staff_id = a.staff_id
        WHERE a.token_hash = :tokenHash AND a.expires_at > SYSTIMESTAMP AND s.is_active = 'Y'`,
      { tokenHash: hashToken(token) }, objectRows
    );
    return result.rows[0] ? verifySecret(pin, result.rows[0].PIN_HASH) : false;
  });
}

export async function deleteSession(token) {
  if (!token) return;
  return withOracleTransaction(async (connection) => {
    await connection.execute('DELETE FROM auth_sessions WHERE token_hash = :tokenHash', { tokenHash: hashToken(token) });
  });
}