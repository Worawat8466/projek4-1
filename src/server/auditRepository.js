import oracledb from 'oracledb';
import { withOracleConnection } from './oraclePool.js';

export async function listAuditLogs(limit = 100) {
  const rowLimit = Math.min(250, Math.max(1, Number(limit) || 100));
  return withOracleConnection(async (connection) => {
    const result = await connection.execute(
      `SELECT a.audit_log_id, a.action, a.entity_name, a.entity_id,
              DBMS_LOB.SUBSTR(a.details, 1000, 1) AS details,
              a.created_at, s.first_name, s.last_name, s.email, r.role_name
         FROM audit_logs a
         LEFT JOIN staff s ON s.staff_id = a.staff_id
         LEFT JOIN staff_roles r ON r.role_id = s.role_id
        ORDER BY a.created_at DESC, a.audit_log_id DESC
        FETCH FIRST :rowLimit ROWS ONLY`,
      { rowLimit },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows.map((row) => ({
      id: Number(row.AUDIT_LOG_ID),
      action: row.ACTION,
      entity: row.ENTITY_NAME || '',
      entityId: row.ENTITY_ID == null ? null : Number(row.ENTITY_ID),
      details: row.DETAILS ? JSON.parse(row.DETAILS) : null,
      createdAt: new Date(row.CREATED_AT).toISOString(),
      staffName: [row.FIRST_NAME, row.LAST_NAME].filter(Boolean).join(' ') || 'บัญชีที่ปิดใช้งาน',
      email: row.EMAIL || '',
      role: row.ROLE_NAME || ''
    }));
  });
}
