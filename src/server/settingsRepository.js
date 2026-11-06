import oracledb from 'oracledb';
import { withOracleConnection, withOracleTransaction } from './oraclePool.js';
import { defaultSettings } from '../appSettings.js';
import { writeAuditLog } from './authRepository.js';

export async function getClinicSettings() {
  return withOracleConnection(async (connection) => {
    const result = await connection.execute(
      `SELECT DBMS_LOB.SUBSTR(settings_json, 4000, 1) AS settings_json
         FROM clinic_settings WHERE settings_id = 1`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (!result.rows[0]) throw Object.assign(new Error('settings_not_found'), { code: 'SETTINGS_NOT_FOUND' });
    const settings = JSON.parse(result.rows[0].SETTINGS_JSON);
    return {
      ...defaultSettings,
      ...settings,
      paymentMethods: { ...defaultSettings.paymentMethods, ...settings.paymentMethods }
    };
  });
}

export async function saveClinicSettings(settings, updatedBy = null) {
  const settingsJson = JSON.stringify(settings);
  if (settingsJson.length > 3900) throw Object.assign(new Error('settings_too_large'), { code: 'INVALID_SETTINGS' });
  return withOracleTransaction(async (connection) => {
    const update = await connection.execute(
      `UPDATE clinic_settings SET settings_json = :settingsJson, updated_by = :updatedBy, updated_at = SYSTIMESTAMP
        WHERE settings_id = 1`,
      { settingsJson, updatedBy }
    );
    if (!update.rowsAffected) {
      await connection.execute(
        'INSERT INTO clinic_settings (settings_id, settings_json, updated_by) VALUES (1, :settingsJson, :updatedBy)',
        { settingsJson, updatedBy }
      );
    }
    await writeAuditLog(connection, updatedBy, 'CLINIC_SETTINGS_UPDATED', 'CLINIC_SETTINGS', 1);
    return settings;
  });
}