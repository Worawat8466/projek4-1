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

export async function writeAuditLog(connection, staffId, action, entityName = null, entityId = null, details = null) {
  await connection.execute(
    `INSERT INTO audit_logs (staff_id, action, entity_name, entity_id, details)
     VALUES (:staffId, :action, :entityName, :entityId, :details)`,
    { staffId, action, entityName, entityId, details: details == null ? null : JSON.stringify(details) }
  );
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
        WHERE r.role_code = 'ADMIN' AND s.is_active = 'Y' AND s.password_hash IS NOT NULL`,
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
    const existingAccount = await connection.execute(
      `SELECT s.staff_id, s.is_active, r.role_code FROM staff s
         JOIN staff_roles r ON r.role_id = s.role_id WHERE LOWER(s.email) = :email FOR UPDATE`,
      { email }, objectRows
    );
    let staffId;
    if (existingAccount.rows[0]) {
      if (existingAccount.rows[0].ROLE_CODE !== 'ADMIN') {
        throw Object.assign(new Error('email_already_in_use'), { code: 'DUPLICATE_EMAIL' });
      }
      staffId = existingAccount.rows[0].STAFF_ID;
      await connection.execute(
        `UPDATE staff SET role_id = :roleId, first_name = :firstName, last_name = :lastName,
                password_hash = :passwordHash, pin_hash = :pinHash, recovery_code_hash = :recoveryCodeHash,
                is_active = 'Y', recovery_used_at = NULL, updated_at = SYSTIMESTAMP
          WHERE staff_id = :staffId`,
        { ...staffBinds, staffId }
      );
    } else {
      await connection.execute(
        `INSERT INTO staff (role_id, first_name, last_name, email, password_hash, pin_hash, recovery_code_hash)
         VALUES (:roleId, :firstName, :lastName, :email, :passwordHash, :pinHash, :recoveryCodeHash)`,
        staffBinds
      );
      const staffResult = await connection.execute(
        'SELECT staff_id FROM staff WHERE email = :email', { email }, objectRows
      );
      staffId = staffResult.rows[0].STAFF_ID;
    }
    await writeAuditLog(connection, staffId, 'ADMIN_SETUP', 'STAFF', Number(staffId));
    const token = await createSession(connection, staffId);
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
    await writeAuditLog(connection, staff.STAFF_ID, 'LOGIN', 'STAFF', staff.STAFF_ID);
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
    await writeAuditLog(connection, staff.STAFF_ID, 'ACCOUNT_RECOVERED', 'STAFF', staff.STAFF_ID);
    await connection.execute('DELETE FROM auth_sessions WHERE staff_id = :staffId', { staffId: staff.STAFF_ID });
  });
}

export async function changeAdminCredentials(token, input) {
  if ((input.password && input.password.length < 8) || (input.pin && !/^\d{4,6}$/.test(input.pin)) || (!input.password && !input.pin)) {
    throw Object.assign(new Error('invalid_credentials'), { code: 'INVALID_CREDENTIALS' });
  }
  return withOracleTransaction(async (connection) => {
    const result = await connection.execute(
      `SELECT s.staff_id, s.password_hash, r.role_code FROM auth_sessions a
         JOIN staff s ON s.staff_id = a.staff_id
         JOIN staff_roles r ON r.role_id = s.role_id
        WHERE a.token_hash = :tokenHash AND a.expires_at > SYSTIMESTAMP AND s.is_active = 'Y'
        FOR UPDATE OF s.password_hash`,
      { tokenHash: hashToken(token) }, objectRows
    );
    const staff = result.rows[0];
    if (!staff || staff.ROLE_CODE !== 'ADMIN' || !(await verifySecret(input.currentPassword || '', staff.PASSWORD_HASH))) {
      throw Object.assign(new Error('invalid_credentials'), { code: 'INVALID_CREDENTIALS' });
    }
    const passwordHash = input.password ? await hashSecret(input.password) : null;
    const pinHash = input.pin ? await hashSecret(input.pin) : null;
    const assignments = [];
    const binds = { staffId: staff.STAFF_ID };
    if (passwordHash) { assignments.push('password_hash = :passwordHash'); binds.passwordHash = passwordHash; }
    if (pinHash) { assignments.push('pin_hash = :pinHash'); binds.pinHash = pinHash; }
    await connection.execute(
      `UPDATE staff SET ${assignments.join(', ')}, updated_at = SYSTIMESTAMP WHERE staff_id = :staffId`,
      binds
    );
    await writeAuditLog(connection, staff.STAFF_ID, 'ADMIN_CREDENTIALS_CHANGED', 'STAFF', staff.STAFF_ID, {
      passwordChanged: Boolean(passwordHash), pinChanged: Boolean(pinHash)
    });
    return { passwordChanged: Boolean(passwordHash), pinChanged: Boolean(pinHash) };
  });
}

export async function rotateAdminRecoveryCode(token, input) {
  return withOracleTransaction(async (connection) => {
    const result = await connection.execute(
      `SELECT s.staff_id, s.password_hash, r.role_code FROM auth_sessions a
         JOIN staff s ON s.staff_id = a.staff_id
         JOIN staff_roles r ON r.role_id = s.role_id
        WHERE a.token_hash = :tokenHash AND a.expires_at > SYSTIMESTAMP AND s.is_active = 'Y'
        FOR UPDATE OF s.recovery_code_hash`,
      { tokenHash: hashToken(token) }, objectRows
    );
    const staff = result.rows[0];
    if (!staff || staff.ROLE_CODE !== 'ADMIN' || !(await verifySecret(input.currentPassword || '', staff.PASSWORD_HASH))) {
      throw Object.assign(new Error('invalid_credentials'), { code: 'INVALID_CREDENTIALS' });
    }
    const recoveryCode = makeRecoveryCode();
    await connection.execute(
      'UPDATE staff SET recovery_code_hash = :recoveryCodeHash, updated_at = SYSTIMESTAMP WHERE staff_id = :staffId',
      { recoveryCodeHash: await hashSecret(recoveryCode), staffId: staff.STAFF_ID }
    );
    await writeAuditLog(connection, staff.STAFF_ID, 'RECOVERY_CODE_ROTATED', 'STAFF', staff.STAFF_ID);
    return { recoveryCode };
  });
}

export async function resetAdminSetup(token, input) {
  return withOracleTransaction(async (connection) => {
    const result = await connection.execute(
      `SELECT s.staff_id, s.password_hash, r.role_code FROM auth_sessions a
         JOIN staff s ON s.staff_id = a.staff_id
         JOIN staff_roles r ON r.role_id = s.role_id
        WHERE a.token_hash = :tokenHash AND a.expires_at > SYSTIMESTAMP AND s.is_active = 'Y'
        FOR UPDATE OF s.password_hash`,
      { tokenHash: hashToken(token) }, objectRows
    );
    const staff = result.rows[0];
    if (!staff || staff.ROLE_CODE !== 'ADMIN' || !(await verifySecret(input.currentPassword || '', staff.PASSWORD_HASH))) {
      throw Object.assign(new Error('invalid_credentials'), { code: 'INVALID_CREDENTIALS' });
    }
    await writeAuditLog(connection, staff.STAFF_ID, 'ADMIN_SETUP_RESET', 'STAFF', staff.STAFF_ID, {
      businessDataPreserved: true
    });
    await connection.execute(
      `UPDATE staff s
          SET is_active = 'N', password_hash = NULL, pin_hash = NULL, recovery_code_hash = NULL,
              updated_at = SYSTIMESTAMP
        WHERE EXISTS (SELECT 1 FROM staff_roles r WHERE r.role_id = s.role_id AND r.role_code = 'ADMIN')`
    );
    await connection.execute('DELETE FROM auth_sessions');
  });
}

export async function resetAdminSetupForDemo() {
  return withOracleTransaction(async (connection) => {
    const admins = await connection.execute(
      `SELECT s.staff_id FROM staff s JOIN staff_roles r ON r.role_id = s.role_id
        WHERE r.role_code = 'ADMIN' AND s.is_active = 'Y' FOR UPDATE OF s.is_active`,
      [], objectRows
    );
    for (const admin of admins.rows) {
      await writeAuditLog(connection, admin.STAFF_ID, 'ADMIN_SETUP_RESET_FOR_DEMO', 'STAFF', admin.STAFF_ID, {
        businessDataPreserved: true
      });
    }
    await connection.execute(
      `UPDATE staff s SET is_active = 'N', password_hash = NULL, pin_hash = NULL,
              recovery_code_hash = NULL, updated_at = SYSTIMESTAMP
        WHERE EXISTS (SELECT 1 FROM staff_roles r WHERE r.role_id = s.role_id AND r.role_code = 'ADMIN')`
    );
    await connection.execute('DELETE FROM auth_sessions');
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
    const result = await connection.execute(
      `SELECT staff_id FROM auth_sessions WHERE token_hash = :tokenHash`,
      { tokenHash: hashToken(token) }, objectRows
    );
    if (result.rows[0]) await writeAuditLog(connection, result.rows[0].STAFF_ID, 'LOGOUT', 'STAFF', result.rows[0].STAFF_ID);
    await connection.execute('DELETE FROM auth_sessions WHERE token_hash = :tokenHash', { tokenHash: hashToken(token) });
  });
}

export function hashStaffSecret(secret) {
  return hashSecret(secret);
}

export async function getSessionIdentity(token) {
  if (!token) return null;
  return withOracleConnection(async (connection) => {
    const result = await connection.execute(
      `SELECT s.staff_id, s.first_name, s.last_name, s.email, r.role_code,
              DBMS_LOB.SUBSTR(r.permissions_json, 4000, 1) AS permissions_json
         FROM auth_sessions a
         JOIN staff s ON s.staff_id = a.staff_id
         JOIN staff_roles r ON r.role_id = s.role_id
        WHERE a.token_hash = :tokenHash AND a.expires_at > SYSTIMESTAMP AND s.is_active = 'Y'`,
      { tokenHash: hashToken(token) }, objectRows
    );
    const row = result.rows[0];
    if (!row) return null;
    let permissions = {};
    try { permissions = JSON.parse(row.PERMISSIONS_JSON || '{}'); } catch { permissions = {}; }
    return {
      staffId: Number(row.STAFF_ID),
      name: [row.FIRST_NAME, row.LAST_NAME].filter(Boolean).join(' '),
      email: row.EMAIL,
      roleCode: row.ROLE_CODE,
      permissions
    };
  });
}