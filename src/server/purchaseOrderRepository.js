import oracledb from 'oracledb';
import { withOracleConnection, withOracleTransaction } from './oraclePool.js';

async function loadPurchaseOrder(connection, purchaseOrderId) {
  const result = await connection.execute(
    `SELECT po.purchase_order_id, po.po_number, po.ordered_at, po.status,
            s.supplier_code, s.company_name,
            poi.purchase_order_item_id, poi.product_id, p.product_code, p.product_name,
            pu.unit_name, pu.base_units_per_unit, poi.quantity_ordered, poi.quantity_received,
            poi.unit_cost
       FROM purchase_orders po
       JOIN suppliers s ON s.supplier_id = po.supplier_id
       JOIN purchase_order_items poi ON poi.purchase_order_id = po.purchase_order_id
       JOIN products p ON p.product_id = poi.product_id
       JOIN product_units pu ON pu.unit_id = poi.unit_id
      WHERE po.purchase_order_id = :purchaseOrderId
      ORDER BY poi.purchase_order_item_id`,
    { purchaseOrderId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );
  if (!result.rows.length) return null;
  const first = result.rows[0];
  return {
    id: first.PO_NUMBER,
    purchaseOrderId: Number(first.PURCHASE_ORDER_ID),
    orderedAt: new Date(first.ORDERED_AT).toISOString().slice(0, 10),
    supplierCode: first.SUPPLIER_CODE,
    supplier: first.COMPANY_NAME,
    status: first.STATUS,
    items: result.rows.map((row) => ({
      id: Number(row.PURCHASE_ORDER_ITEM_ID),
      productId: row.PRODUCT_CODE,
      item: row.PRODUCT_NAME,
      quantity: Number(row.QUANTITY_ORDERED),
      receivedQuantity: Number(row.QUANTITY_RECEIVED),
      packUnit: row.UNIT_NAME,
      multiplier: Number(row.BASE_UNITS_PER_UNIT),
      packPrice: Number(row.UNIT_COST),
      total: Number(row.QUANTITY_ORDERED) * Number(row.UNIT_COST)
    })),
    total: result.rows.reduce((sum, row) => sum + Number(row.QUANTITY_ORDERED) * Number(row.UNIT_COST), 0)
  };
}

export async function listPurchaseOrders() {
  return withOracleConnection(async (connection) => {
    const headers = await connection.execute(
      `SELECT purchase_order_id FROM purchase_orders ORDER BY ordered_at DESC, purchase_order_id DESC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const orders = await Promise.all(headers.rows.map((row) => loadPurchaseOrder(connection, row.PURCHASE_ORDER_ID)));
    return orders.filter(Boolean);
  });
}

export async function createPurchaseOrder(input) {
  return withOracleTransaction(async (connection) => {
    const supplier = await connection.execute(
      `SELECT supplier_id FROM suppliers WHERE supplier_code = :supplierCode AND is_active = 'Y'`,
      { supplierCode: input.supplierCode },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (!supplier.rows[0]) throw Object.assign(new Error('supplier_not_found'), { code: 'SUPPLIER_NOT_FOUND' });

    const product = await connection.execute(
      `SELECT product_id, product_name, tracks_stock FROM products
        WHERE product_code = :productCode AND is_active = 'Y'`,
      { productCode: input.productCode },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (!product.rows[0]) throw Object.assign(new Error('product_not_found'), { code: 'PRODUCT_NOT_FOUND' });
    if (product.rows[0].TRACKS_STOCK !== 'Y') throw Object.assign(new Error('service_not_stocked'), { code: 'SERVICE_NOT_STOCKED' });

    const unit = await connection.execute(
      `SELECT unit_id FROM product_units WHERE product_id = :productId AND unit_name = :unitName`,
      { productId: product.rows[0].PRODUCT_ID, unitName: input.packUnit },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (!unit.rows[0]) throw Object.assign(new Error('unit_not_found'), { code: 'UNIT_NOT_FOUND' });

    const quantity = Number(input.quantity);
    const unitCost = Number(input.packPrice);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
      throw Object.assign(new Error('invalid_order_line'), { code: 'INVALID_ORDER_LINE' });
    }
    const orderDate = new Date();
    const poNumber = input.poNumber?.trim() || `PO-${orderDate.getFullYear()}-${String(Date.now()).slice(-6)}`;
    const header = await connection.execute(
      `INSERT INTO purchase_orders (po_number, supplier_id, status, ordered_at, notes)
       VALUES (:poNumber, :supplierId, 'ORDERED', SYSTIMESTAMP, :notes)
       RETURNING purchase_order_id INTO :purchaseOrderId`,
      {
        poNumber,
        supplierId: supplier.rows[0].SUPPLIER_ID,
        notes: input.notes?.trim() || null,
        purchaseOrderId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      }
    );
    const purchaseOrderId = header.outBinds.purchaseOrderId[0];
    await connection.execute(
      `INSERT INTO purchase_order_items
         (purchase_order_id, product_id, unit_id, quantity_ordered, quantity_received, unit_cost)
       VALUES (:purchaseOrderId, :productId, :unitId, :quantity, 0, :unitCost)`,
      {
        purchaseOrderId,
        productId: product.rows[0].PRODUCT_ID,
        unitId: unit.rows[0].UNIT_ID,
        quantity,
        unitCost
      }
    );
    return loadPurchaseOrder(connection, purchaseOrderId);
  });
}

export async function receivePurchaseOrderLine(purchaseOrderId, input) {
  return withOracleTransaction(async (connection) => {
    const orderResult = await connection.execute(
      `SELECT purchase_order_id, po_number, status FROM purchase_orders
        WHERE purchase_order_id = :purchaseOrderId FOR UPDATE`,
      { purchaseOrderId: Number(purchaseOrderId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const order = orderResult.rows[0];
    if (!order) throw Object.assign(new Error('purchase_order_not_found'), { code: 'PURCHASE_ORDER_NOT_FOUND' });
    if (order.STATUS === 'CANCELLED') throw Object.assign(new Error('purchase_order_cancelled'), { code: 'PURCHASE_ORDER_CANCELLED' });

    const lineResult = await connection.execute(
      `SELECT poi.purchase_order_item_id, poi.product_id, poi.unit_id, poi.quantity_ordered,
              poi.quantity_received, poi.unit_cost, p.product_code, p.product_name, p.base_unit,
              pu.unit_name, pu.base_units_per_unit
         FROM purchase_order_items poi
         JOIN products p ON p.product_id = poi.product_id
         JOIN product_units pu ON pu.unit_id = poi.unit_id
        WHERE poi.purchase_order_id = :purchaseOrderId
        ORDER BY poi.purchase_order_item_id
        FOR UPDATE OF poi.quantity_received`,
      { purchaseOrderId: order.PURCHASE_ORDER_ID },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const line = lineResult.rows.find((row) => row.PRODUCT_CODE === input.productCode);
    if (!line) throw Object.assign(new Error('purchase_order_line_not_found'), { code: 'PURCHASE_ORDER_LINE_NOT_FOUND' });
    const quantity = Number(input.quantity);
    const remaining = Number(line.QUANTITY_ORDERED) - Number(line.QUANTITY_RECEIVED);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > remaining) {
      throw Object.assign(new Error('invalid_receipt_quantity'), { code: 'INVALID_RECEIPT_QUANTITY' });
    }
    if (!input.lotNumber?.trim() || !input.expiryDate) throw Object.assign(new Error('lot_and_expiry_required'), { code: 'LOT_AND_EXPIRY_REQUIRED' });
    const expiryDate = new Date(`${input.expiryDate}T00:00:00`);
    if (Number.isNaN(expiryDate.getTime())) throw Object.assign(new Error('invalid_expiry_date'), { code: 'INVALID_EXPIRY_DATE' });
    const multiplier = Number(line.BASE_UNITS_PER_UNIT);
    const baseQuantity = quantity * multiplier;
    const lotResult = await connection.execute(
      `SELECT inventory_lot_id, expiry_date FROM inventory_lots
        WHERE product_id = :productId AND lot_number = :lotNumber FOR UPDATE`,
      { productId: line.PRODUCT_ID, lotNumber: input.lotNumber.trim() },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const existingLot = lotResult.rows[0];
    let inventoryLotId;
    if (existingLot) {
      const previousExpiry = existingLot.EXPIRY_DATE ? new Date(existingLot.EXPIRY_DATE).toISOString().slice(0, 10) : null;
      if (previousExpiry !== input.expiryDate) throw Object.assign(new Error('lot_expiry_mismatch'), { code: 'LOT_EXPIRY_MISMATCH' });
      inventoryLotId = existingLot.INVENTORY_LOT_ID;
      await connection.execute(
        `UPDATE inventory_lots SET received_base_quantity = received_base_quantity + :baseQuantity,
                remaining_base_quantity = remaining_base_quantity + :baseQuantity
          WHERE inventory_lot_id = :inventoryLotId`,
        { baseQuantity, inventoryLotId }
      );
    } else {
      const insertLot = await connection.execute(
        `INSERT INTO inventory_lots
           (product_id, purchase_order_item_id, lot_number, expiry_date, received_at,
            received_base_quantity, remaining_base_quantity, unit_cost_base)
         VALUES (:productId, :purchaseOrderItemId, :lotNumber, :expiryDate, :receivedAt,
                 :baseQuantity, :baseQuantity, :unitCostBase)
         RETURNING inventory_lot_id INTO :inventoryLotId`,
        {
          productId: line.PRODUCT_ID,
          purchaseOrderItemId: line.PURCHASE_ORDER_ITEM_ID,
          lotNumber: input.lotNumber.trim(),
          expiryDate,
          receivedAt: input.receivedAt ? new Date(`${input.receivedAt}T00:00:00`) : new Date(),
          baseQuantity,
          unitCostBase: Number(line.UNIT_COST) / multiplier,
          inventoryLotId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
        }
      );
      inventoryLotId = insertLot.outBinds.inventoryLotId[0];
    }

    await connection.execute(
      `UPDATE purchase_order_items SET quantity_received = quantity_received + :quantity
        WHERE purchase_order_item_id = :purchaseOrderItemId`,
      { quantity, purchaseOrderItemId: line.PURCHASE_ORDER_ITEM_ID }
    );
    await connection.execute(
      `INSERT INTO inventory_movements
         (inventory_lot_id, movement_type, base_quantity, reference_type, reference_id, reason)
       VALUES (:inventoryLotId, 'RECEIVE', :baseQuantity, 'PURCHASE_ORDER', :poNumber, :reason)`,
      { inventoryLotId, baseQuantity, poNumber: order.PO_NUMBER, reason: input.reason || 'รับสินค้าตามใบสั่งซื้อ' }
    );

    const totals = await connection.execute(
      `SELECT SUM(quantity_ordered) AS ORDERED, SUM(quantity_received) AS RECEIVED
         FROM purchase_order_items WHERE purchase_order_id = :purchaseOrderId`,
      { purchaseOrderId: order.PURCHASE_ORDER_ID },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const status = Number(totals.rows[0].RECEIVED) >= Number(totals.rows[0].ORDERED) ? 'RECEIVED' : 'PARTIAL';
    await connection.execute(
      `UPDATE purchase_orders SET status = :status, updated_at = SYSTIMESTAMP WHERE purchase_order_id = :purchaseOrderId`,
      { status, purchaseOrderId: order.PURCHASE_ORDER_ID }
    );
    const updatedOrder = await loadPurchaseOrder(connection, order.PURCHASE_ORDER_ID);
    return { order: updatedOrder, inventoryLotId, baseQuantity };
  });
}
