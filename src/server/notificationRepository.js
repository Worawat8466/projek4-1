import oracledb from 'oracledb';
import { withOracleConnection, withOracleTransaction } from './oraclePool.js';

const objectRows = { outFormat: oracledb.OUT_FORMAT_OBJECT };

async function loadAlertCandidates() {
  return withOracleConnection(async (connection) => {
    const lowStock = await connection.execute(
      `SELECT 'LOW_STOCK:' || p.product_code AS notification_key,
              'LOW_STOCK' AS notification_type,
              CASE WHEN NVL(SUM(l.remaining_base_quantity), 0) = 0 THEN 'critical' ELSE 'warning' END AS severity,
              'สินค้าใกล้หมด' AS title,
              'คงเหลือ ' || TO_CHAR(NVL(SUM(l.remaining_base_quantity), 0)) || ' ' || p.base_unit ||
                ' (ขั้นต่ำ ' || TO_CHAR(p.min_stock) || ' ' || p.base_unit || ')' AS message,
              '/inventory' AS action_href
         FROM products p LEFT JOIN inventory_lots l ON l.product_id = p.product_id
        WHERE p.is_active = 'Y' AND p.tracks_stock = 'Y' AND p.min_stock > 0
        GROUP BY p.product_code, p.base_unit, p.min_stock
       HAVING NVL(SUM(l.remaining_base_quantity), 0) <= p.min_stock`,
      [], objectRows
    );
    const expiringLots = await connection.execute(
      `SELECT 'EXPIRING_LOT:' || p.product_code || ':' || l.lot_number AS notification_key,
              'EXPIRING_LOT' AS notification_type,
              CASE WHEN l.expiry_date < TRUNC(SYSDATE) THEN 'critical' ELSE 'warning' END AS severity,
              CASE WHEN l.expiry_date < TRUNC(SYSDATE) THEN 'ล็อตหมดอายุ' ELSE 'ล็อตใกล้หมดอายุ' END AS title,
              'ล็อต ' || l.lot_number || ' · หมดอายุ ' || TO_CHAR(l.expiry_date, 'DD/MM/YYYY') ||
                ' · เหลือ ' || TO_CHAR(l.remaining_base_quantity) || ' ' || p.base_unit AS message,
              '/inventory' AS action_href
         FROM inventory_lots l JOIN products p ON p.product_id = l.product_id
        WHERE p.is_active = 'Y' AND p.tracks_stock = 'Y'
          AND l.remaining_base_quantity > 0 AND l.expiry_date < TRUNC(SYSDATE) + 31`,
      [], objectRows
    );
    const pendingOrders = await connection.execute(
      `SELECT 'PO_PENDING:' || po.po_number AS notification_key,
              'PO_PENDING' AS notification_type,
              'info' AS severity,
              'ใบสั่งซื้อรอตรวจรับ' AS title,
              po.po_number || ' · ' || s.company_name || ' · ค้างรับ ' || COUNT(*) || ' รายการ' AS message,
              '/purchase-orders' AS action_href
         FROM purchase_orders po
         JOIN suppliers s ON s.supplier_id = po.supplier_id
         JOIN purchase_order_items poi ON poi.purchase_order_id = po.purchase_order_id
        WHERE po.status IN ('ORDERED', 'PARTIAL')
        GROUP BY po.po_number, s.company_name
       HAVING SUM(poi.quantity_ordered - poi.quantity_received) > 0`,
      [], objectRows
    );
    return [...lowStock.rows, ...expiringLots.rows, ...pendingOrders.rows];
  });
}

export async function syncNotifications() {
  const candidates = await loadAlertCandidates();
  const candidateKeys = new Set(candidates.map((item) => item.NOTIFICATION_KEY));
  return withOracleTransaction(async (connection) => {
    const existingResult = await connection.execute(
      `SELECT notification_id, notification_key, notification_type, severity, title, message,
              action_href, is_active FROM app_notifications
        WHERE notification_type IN ('LOW_STOCK', 'EXPIRING_LOT', 'PO_PENDING') FOR UPDATE`,
      [], objectRows
    );
    const existingByKey = new Map(existingResult.rows.map((row) => [row.NOTIFICATION_KEY, row]));

    for (const row of existingResult.rows) {
      if (row.IS_ACTIVE === 'Y' && !candidateKeys.has(row.NOTIFICATION_KEY)) {
        await connection.execute(
          `UPDATE app_notifications SET is_active = 'N', updated_at = SYSTIMESTAMP
            WHERE notification_id = :notificationId`,
          { notificationId: row.NOTIFICATION_ID }
        );
      }
    }

    for (const candidate of candidates) {
      const existing = existingByKey.get(candidate.NOTIFICATION_KEY);
      if (existing) {
        if (existing.IS_ACTIVE !== 'Y') {
          await connection.execute(
            'DELETE FROM notification_reads WHERE notification_id = :notificationId',
            { notificationId: existing.NOTIFICATION_ID }
          );
        }
        const contentChanged = existing.NOTIFICATION_TYPE !== candidate.NOTIFICATION_TYPE ||
          existing.SEVERITY !== candidate.SEVERITY || existing.TITLE !== candidate.TITLE ||
          existing.MESSAGE !== candidate.MESSAGE || existing.ACTION_HREF !== candidate.ACTION_HREF;
        if (existing.IS_ACTIVE === 'Y' && !contentChanged) continue;
        await connection.execute(
          `UPDATE app_notifications
              SET notification_type = :notificationType, severity = :severity, title = :title,
                  message = :message, action_href = :actionHref, is_active = 'Y', updated_at = SYSTIMESTAMP
            WHERE notification_id = :notificationId`,
          {
            notificationType: candidate.NOTIFICATION_TYPE,
            severity: candidate.SEVERITY,
            title: candidate.TITLE,
            message: candidate.MESSAGE,
            actionHref: candidate.ACTION_HREF,
            notificationId: existing.NOTIFICATION_ID
          }
        );
        continue;
      }

      await connection.execute(
        `INSERT INTO app_notifications
           (notification_key, notification_type, severity, title, message, action_href)
         VALUES (:notificationKey, :notificationType, :severity, :title, :message, :actionHref)`,
        {
          notificationKey: candidate.NOTIFICATION_KEY,
          notificationType: candidate.NOTIFICATION_TYPE,
          severity: candidate.SEVERITY,
          title: candidate.TITLE,
          message: candidate.MESSAGE,
          actionHref: candidate.ACTION_HREF
        }
      );
    }
    return { activeCount: candidates.length };
  });
}

export async function listNotifications(readerKey) {
  return withOracleConnection(async (connection) => {
    const [itemsResult, countResult] = await Promise.all([
      connection.execute(
        `SELECT n.notification_id, n.notification_type, n.severity, n.title, n.message,
                n.action_href, n.created_at, n.updated_at, r.read_at
           FROM app_notifications n
           LEFT JOIN notification_reads r
             ON r.notification_id = n.notification_id AND r.reader_key = :readerKey
          WHERE n.is_active = 'Y'
          ORDER BY CASE n.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
                   n.updated_at DESC
          FETCH FIRST 50 ROWS ONLY`,
        { readerKey }, objectRows
      ),
      connection.execute(
        `SELECT COUNT(*) AS unread_count
           FROM app_notifications n
           LEFT JOIN notification_reads r
             ON r.notification_id = n.notification_id AND r.reader_key = :readerKey
          WHERE n.is_active = 'Y' AND r.notification_id IS NULL`,
        { readerKey }, objectRows
      )
    ]);
    return {
      unreadCount: Number(countResult.rows[0].UNREAD_COUNT),
      notifications: itemsResult.rows.map((row) => ({
        id: Number(row.NOTIFICATION_ID),
        type: row.NOTIFICATION_TYPE,
        severity: row.SEVERITY,
        title: row.TITLE,
        message: row.MESSAGE,
        href: row.ACTION_HREF,
        read: Boolean(row.READ_AT),
        updatedAt: new Date(row.UPDATED_AT).toISOString()
      }))
    };
  });
}

export async function markNotificationsRead(readerKey, notificationId = null) {
  return withOracleTransaction(async (connection) => {
    if (notificationId == null) {
      await connection.execute(
        `INSERT INTO notification_reads (notification_id, reader_key)
         SELECT n.notification_id, :readerKey FROM app_notifications n
          WHERE n.is_active = 'Y' AND NOT EXISTS (
            SELECT 1 FROM notification_reads r
             WHERE r.notification_id = n.notification_id AND r.reader_key = :readerKey
          )`,
        { readerKey }
      );
      return;
    }
    await connection.execute(
      `MERGE INTO notification_reads target
       USING (SELECT notification_id FROM app_notifications
               WHERE notification_id = :notificationId AND is_active = 'Y') source
          ON (target.notification_id = source.notification_id AND target.reader_key = :readerKey)
       WHEN NOT MATCHED THEN INSERT (notification_id, reader_key) VALUES (source.notification_id, :readerKey)`,
      { notificationId, readerKey }
    );
  });
}