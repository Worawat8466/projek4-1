import oracledb from 'oracledb';
import { withOracleTransaction, withOracleConnection } from './oraclePool.js';

function isoDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return String(value).slice(0, 10);
}

function mapLot(row) {
  return {
    inventoryLotId: Number(row.INVENTORY_LOT_ID),
    id: row.PRODUCT_CODE,
    productId: row.PRODUCT_CODE,
    name: row.PRODUCT_NAME,
    batch: row.LOT_NUMBER,
    expiry: isoDate(row.EXPIRY_DATE),
    received: isoDate(row.RECEIVED_AT),
    units: Number(row.REMAINING_BASE_QUANTITY),
    receivedBaseQuantity: Number(row.RECEIVED_BASE_QUANTITY),
    minimumStock: Number(row.MIN_STOCK),
    productTotalUnits: Number(row.PRODUCT_TOTAL_UNITS) || 0,
    packs: Number(row.RECEIVED_BASE_QUANTITY) / (Number(row.BASE_UNITS_PER_PACK) || 1),
    baseUnit: row.BASE_UNIT,
    packUnit: row.PACK_UNIT || row.BASE_UNIT,
    multiplier: Number(row.BASE_UNITS_PER_PACK) || 1,
    unitCostBase: row.UNIT_COST_BASE == null ? null : Number(row.UNIT_COST_BASE)
  };
}

const lotSelect = `SELECT l.inventory_lot_id, l.product_id, p.product_code, p.product_name,
                            p.base_unit, p.min_stock, l.lot_number, l.expiry_date, l.received_at,
                          l.received_base_quantity, l.remaining_base_quantity, l.unit_cost_base,
                            (SELECT NVL(SUM(all_lots.remaining_base_quantity), 0)
                              FROM inventory_lots all_lots WHERE all_lots.product_id = l.product_id) AS product_total_units,
                          (SELECT pu.unit_name FROM product_units pu WHERE pu.product_id = p.product_id
                            ORDER BY pu.base_units_per_unit DESC FETCH FIRST 1 ROW ONLY) AS pack_unit,
                          (SELECT pu.base_units_per_unit FROM product_units pu WHERE pu.product_id = p.product_id
                            ORDER BY pu.base_units_per_unit DESC FETCH FIRST 1 ROW ONLY) AS base_units_per_pack
                     FROM inventory_lots l
                     JOIN products p ON p.product_id = l.product_id`;

export async function listInventoryLots() {
  return withOracleConnection(async (connection) => {
    const result = await connection.execute(`${lotSelect} ORDER BY l.expiry_date NULLS LAST, l.received_at`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows.map(mapLot);
  });
}

export async function receiveInventoryLot(input) {
  return withOracleTransaction(async (connection) => {
    const productResult = await connection.execute(
      `SELECT product_id, product_code, product_name, base_unit, base_cost, tracks_stock
         FROM products WHERE product_code = :productCode AND is_active = 'Y' FOR UPDATE`,
      { productCode: input.productCode },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const product = productResult.rows[0];
    if (!product) throw Object.assign(new Error('product_not_found'), { code: 'PRODUCT_NOT_FOUND' });
    if (product.TRACKS_STOCK !== 'Y') throw Object.assign(new Error('service_not_stocked'), { code: 'SERVICE_NOT_STOCKED' });

    const unitResult = await connection.execute(
      `SELECT unit_name, base_units_per_unit FROM product_units
        WHERE product_id = :productId AND unit_name = :unitName`,
      { productId: product.PRODUCT_ID, unitName: input.packUnit },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const unit = unitResult.rows[0];
    if (!unit) throw Object.assign(new Error('unit_not_found'), { code: 'UNIT_NOT_FOUND' });

    const packQuantity = Number(input.packQuantity);
    if (!Number.isFinite(packQuantity) || packQuantity <= 0) throw Object.assign(new Error('invalid_quantity'), { code: 'INVALID_QUANTITY' });
    const multiplier = Number(unit.BASE_UNITS_PER_UNIT);
    const baseQuantity = packQuantity * multiplier;
    const expiryDate = input.expiryDate ? new Date(`${input.expiryDate}T00:00:00`) : null;
    if (expiryDate && Number.isNaN(expiryDate.getTime())) throw Object.assign(new Error('invalid_expiry_date'), { code: 'INVALID_EXPIRY_DATE' });

    const existingResult = await connection.execute(
      `SELECT inventory_lot_id, expiry_date, received_base_quantity, remaining_base_quantity
         FROM inventory_lots WHERE product_id = :productId AND lot_number = :lotNumber FOR UPDATE`,
      { productId: product.PRODUCT_ID, lotNumber: input.lotNumber.trim() },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const existing = existingResult.rows[0];
    let inventoryLotId;
    if (existing) {
      const existingExpiry = isoDate(existing.EXPIRY_DATE);
      if (existingExpiry !== input.expiryDate) throw Object.assign(new Error('lot_expiry_mismatch'), { code: 'LOT_EXPIRY_MISMATCH' });
      inventoryLotId = existing.INVENTORY_LOT_ID;
      await connection.execute(
        `UPDATE inventory_lots
            SET received_base_quantity = received_base_quantity + :baseQuantity,
                remaining_base_quantity = remaining_base_quantity + :baseQuantity
          WHERE inventory_lot_id = :inventoryLotId`,
        { baseQuantity, inventoryLotId }
      );
    } else {
            await connection.execute(
        `INSERT INTO inventory_lots
           (product_id, purchase_order_item_id, lot_number, expiry_date, received_at,
            received_base_quantity, remaining_base_quantity, unit_cost_base)
         VALUES (:productId, :purchaseOrderItemId, :lotNumber, :expiryDate, :receivedAt,
           :baseQuantity, :baseQuantity, :unitCostBase)`,
        {
          productId: product.PRODUCT_ID,
          purchaseOrderItemId: input.purchaseOrderItemId || null,
          lotNumber: input.lotNumber.trim(),
          expiryDate,
          receivedAt: input.receivedAt ? new Date(`${input.receivedAt}T00:00:00`) : new Date(),
          baseQuantity,
          unitCostBase: input.unitCostBase == null ? product.BASE_COST : Number(input.unitCostBase)
        }
      );
      const insertedLot = await connection.execute(
        `SELECT inventory_lot_id FROM inventory_lots
          WHERE product_id = :productId AND lot_number = :lotNumber`,
        { productId: product.PRODUCT_ID, lotNumber: input.lotNumber.trim() },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      inventoryLotId = insertedLot.rows[0].INVENTORY_LOT_ID;
    }

    await connection.execute(
      `INSERT INTO inventory_movements
         (inventory_lot_id, movement_type, base_quantity, reference_type, reference_id, reason)
       VALUES (:inventoryLotId, 'RECEIVE', :baseQuantity, :referenceType, :referenceId, :reason)`,
      {
        inventoryLotId,
        baseQuantity,
        referenceType: input.purchaseOrderItemId ? 'PURCHASE_ORDER' : 'MANUAL_RECEIPT',
        referenceId: input.referenceId || null,
        reason: input.reason || 'รับสินค้าเข้าคลัง'
      }
    );

    const result = await connection.execute(`${lotSelect} WHERE l.inventory_lot_id = :inventoryLotId`, { inventoryLotId }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return mapLot(result.rows[0]);
  });
}

export async function deductInventoryLot(inventoryLotId, input) {
  return withOracleTransaction(async (connection) => {
    const lotResult = await connection.execute(
      `SELECT l.inventory_lot_id, l.remaining_base_quantity, p.product_code
         FROM inventory_lots l JOIN products p ON p.product_id = l.product_id
        WHERE l.inventory_lot_id = :inventoryLotId FOR UPDATE`,
      { inventoryLotId: Number(inventoryLotId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const lot = lotResult.rows[0];
    if (!lot) throw Object.assign(new Error('lot_not_found'), { code: 'LOT_NOT_FOUND' });
    const quantity = Number(input.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) throw Object.assign(new Error('invalid_quantity'), { code: 'INVALID_QUANTITY' });
    if (quantity > Number(lot.REMAINING_BASE_QUANTITY)) throw Object.assign(new Error('insufficient_stock'), { code: 'INSUFFICIENT_STOCK' });

    await connection.execute(
      `UPDATE inventory_lots SET remaining_base_quantity = remaining_base_quantity - :quantity
        WHERE inventory_lot_id = :inventoryLotId`,
      { quantity, inventoryLotId: lot.INVENTORY_LOT_ID }
    );
    await connection.execute(
      `INSERT INTO inventory_movements
         (inventory_lot_id, movement_type, base_quantity, reference_type, reference_id, reason)
       VALUES (:inventoryLotId, :movementType, :quantity, 'INVENTORY_ADJUSTMENT', :referenceId, :reason)`,
      {
        inventoryLotId: lot.INVENTORY_LOT_ID,
        movementType: input.movementType,
        quantity,
        referenceId: input.referenceId || null,
        reason: input.reason + (input.note ? `: ${input.note}` : '')
      }
    );

    const updated = await connection.execute(`${lotSelect} WHERE l.inventory_lot_id = :inventoryLotId`, { inventoryLotId: lot.INVENTORY_LOT_ID }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return mapLot(updated.rows[0]);
  });
}
