import { randomUUID } from 'node:crypto';
import oracledb from 'oracledb';
import { withOracleConnection, withOracleTransaction } from './oraclePool.js';

const objectRows = { outFormat: oracledb.OUT_FORMAT_OBJECT };

export async function createSale(input) {
  return withOracleTransaction(async (connection) => {
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw Object.assign(new Error('sale_items_required'), { code: 'INVALID_SALE' });
    }
    const paymentMethod = ({ 'เงินสด': 'CASH', CASH: 'CASH', 'พร้อมเพย์': 'PROMPTPAY', PROMPTPAY: 'PROMPTPAY' })[input.paymentMethod];
    if (!paymentMethod) throw Object.assign(new Error('invalid_payment_method'), { code: 'INVALID_PAYMENT_METHOD' });
    const settingsResult = await connection.execute(
      `SELECT DBMS_LOB.SUBSTR(settings_json, 4000, 1) AS settings_json
         FROM clinic_settings WHERE settings_id = 1`,
      [], objectRows
    );
    if (!settingsResult.rows[0]) throw Object.assign(new Error('settings_not_found'), { code: 'SETTINGS_NOT_FOUND' });
    const settings = JSON.parse(settingsResult.rows[0].SETTINGS_JSON);
    const paymentKey = paymentMethod === 'CASH' ? 'cash' : 'promptpay';
    if (!settings.paymentMethods?.[paymentKey]) {
      throw Object.assign(new Error('invalid_payment_method'), { code: 'INVALID_PAYMENT_METHOD' });
    }

    let customerId = null;
    if (input.customerCode) {
      const result = await connection.execute(
        `SELECT customer_id FROM customers WHERE customer_code = :code AND is_active = 'Y'`,
        { code: input.customerCode }, objectRows
      );
      if (!result.rows[0]) throw Object.assign(new Error('customer_not_found'), { code: 'CUSTOMER_NOT_FOUND' });
      customerId = result.rows[0].CUSTOMER_ID;
    }

    const lines = [];
    for (const inputLine of input.items) {
      const quantity = Number(inputLine.quantity);
      if (!inputLine.productCode || !Number.isFinite(quantity) || quantity <= 0) {
        throw Object.assign(new Error('invalid_sale_line'), { code: 'INVALID_SALE' });
      }
      const productResult = await connection.execute(
        `SELECT product_id, product_name, base_unit, base_sale_price, tracks_stock
           FROM products WHERE product_code = :code AND is_active = 'Y'`,
        { code: inputLine.productCode }, objectRows
      );
      const product = productResult.rows[0];
      if (!product) throw Object.assign(new Error('product_not_found'), { code: 'PRODUCT_NOT_FOUND' });

      let petId = null;
      if (inputLine.petId != null) {
        const petResult = await connection.execute(
          `SELECT p.pet_id FROM pets p JOIN customers c ON c.customer_id = p.customer_id
            WHERE p.pet_id = :petId AND p.is_active = 'Y' AND c.is_active = 'Y'
              AND c.customer_id = :customerId`,
          { petId: Number(inputLine.petId), customerId }, objectRows
        );
        if (!customerId || !petResult.rows[0]) {
          throw Object.assign(new Error('pet_not_owned'), { code: 'PET_NOT_OWNED' });
        }
        petId = petResult.rows[0].PET_ID;
      }
      const unitPrice = Number(product.BASE_SALE_PRICE);
      const existingLine = lines.find((line) => line.product.PRODUCT_ID === product.PRODUCT_ID && line.petId === petId);
      if (existingLine) {
        existingLine.quantity += quantity;
        existingLine.lineTotal += unitPrice * quantity;
      } else {
        lines.push({ product, quantity, petId, unitPrice, lineTotal: unitPrice * quantity, allocations: [] });
      }
    }

    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const discount = Math.min(subtotal, Math.max(0, Number(settings.defaultDiscount) || 0));
    const vatRate = settings.vatEnabled ? Math.min(100, Math.max(0, Number(settings.vatRate) || 0)) : 0;
    const netSales = subtotal - discount;
    const vatAmount = Math.round(netSales * vatRate) / 100;
    const total = netSales + vatAmount;
    const receiptNumber = `${String(settings.receiptPrefix || 'INV-').slice(0, 20)}${randomUUID()}`;
    await connection.execute(
      `INSERT INTO sales
         (receipt_number, customer_id, status, subtotal, discount_amount, net_sales, vat_rate, vat_amount, total_amount)
       VALUES (:receiptNumber, :customerId, 'PAID', :subtotal, :discount, :netSales, :vatRate, :vatAmount, :total)`,
      { receiptNumber, customerId, subtotal, discount, netSales, vatRate, vatAmount, total }
    );
    const saleResult = await connection.execute(
      'SELECT sale_id FROM sales WHERE receipt_number = :receiptNumber',
      { receiptNumber }, objectRows
    );
    const saleId = saleResult.rows[0].SALE_ID;
    const stockByProduct = new Map();

    for (const line of lines) {
      if (line.product.TRACKS_STOCK !== 'Y') continue;
      const productId = line.product.PRODUCT_ID;
      let lots = stockByProduct.get(productId);
      if (!lots) {
        const result = await connection.execute(
          `SELECT inventory_lot_id, remaining_base_quantity, unit_cost_base
             FROM inventory_lots WHERE product_id = :productId AND remaining_base_quantity > 0
               AND (expiry_date IS NULL OR expiry_date >= TRUNC(SYSDATE))
            ORDER BY expiry_date NULLS LAST, received_at, inventory_lot_id FOR UPDATE`,
          { productId }, objectRows
        );
        lots = result.rows.map((row) => ({
          id: row.INVENTORY_LOT_ID,
          remaining: Number(row.REMAINING_BASE_QUANTITY),
          unitCost: row.UNIT_COST_BASE == null ? null : Number(row.UNIT_COST_BASE)
        }));
        stockByProduct.set(productId, lots);
      }
      let quantityLeft = line.quantity;
      for (const lot of lots) {
        const allocated = Math.min(quantityLeft, lot.remaining);
        if (allocated <= 0) continue;
        line.allocations.push({ ...lot, quantity: allocated });
        lot.remaining -= allocated;
        quantityLeft -= allocated;
        if (quantityLeft <= 0) break;
      }
      if (quantityLeft > 0) throw Object.assign(new Error('insufficient_stock'), { code: 'INSUFFICIENT_STOCK' });
    }

    for (const line of lines) {
      const unitCost = line.allocations.length && line.allocations.every((lot) => lot.unitCost != null)
        ? line.allocations.reduce((sum, lot) => sum + lot.quantity * lot.unitCost, 0) / line.quantity
        : null;
      await connection.execute(
        `INSERT INTO sale_items
           (sale_id, product_id, pet_id, product_name_snapshot, unit_name_snapshot,
            quantity, base_quantity, unit_price, unit_cost_snapshot, line_total)
         VALUES (:saleId, :productId, :petId, :productName, :unitName,
                 :quantity, :quantity, :unitPrice, :unitCost, :lineTotal)`,
        {
          saleId, productId: line.product.PRODUCT_ID, petId: line.petId,
          productName: line.product.PRODUCT_NAME, unitName: line.product.BASE_UNIT,
          quantity: line.quantity, unitPrice: line.unitPrice, unitCost, lineTotal: line.lineTotal
        }
      );
      const itemResult = await connection.execute(
        `SELECT sale_item_id FROM sale_items
          WHERE sale_id = :saleId AND product_id = :productId
            AND (pet_id = :petId OR (pet_id IS NULL AND :petId IS NULL))`,
        { saleId, productId: line.product.PRODUCT_ID, petId: line.petId }, objectRows
      );
      const saleItemId = itemResult.rows[0].SALE_ITEM_ID;
      for (const lot of line.allocations) {
        await connection.execute(
          `UPDATE inventory_lots SET remaining_base_quantity = remaining_base_quantity - :quantity
            WHERE inventory_lot_id = :lotId`,
          { quantity: lot.quantity, lotId: lot.id }
        );
        await connection.execute(
          `INSERT INTO sale_lot_allocations (sale_item_id, inventory_lot_id, base_quantity, unit_cost_snapshot)
           VALUES (:saleItemId, :lotId, :quantity, :unitCost)`,
          { saleItemId, lotId: lot.id, quantity: lot.quantity, unitCost: lot.unitCost }
        );
        await connection.execute(
          `INSERT INTO inventory_movements
             (inventory_lot_id, movement_type, base_quantity, reference_type, reference_id, reason)
           VALUES (:lotId, 'SALE', :quantity, 'SALE', :receiptNumber, :reason)`,
          { lotId: lot.id, quantity: lot.quantity, receiptNumber, reason: 'ขายหน้าร้าน' }
        );
      }
    }
    await connection.execute(
      `INSERT INTO sale_payments (sale_id, payment_method, amount) VALUES (:saleId, :paymentMethod, :total)`,
      { saleId, paymentMethod, total }
    );
    return { saleId: Number(saleId), receiptNumber, subtotal, discount, netSales, vatRate, vatAmount, total };
  });
}

export async function listSales(customerCode = null) {
  return withOracleConnection(async (connection) => {
    const result = await connection.execute(
      `SELECT s.sale_id, s.receipt_number, s.sold_at, s.status, s.subtotal, s.discount_amount,
              s.net_sales, s.vat_amount, s.total_amount, c.customer_code, c.first_name, c.last_name,
              sp.payment_method, si.sale_item_id, si.product_name_snapshot, si.unit_name_snapshot,
              si.quantity, si.unit_price, si.unit_cost_snapshot, si.line_total,
              p.product_code, p.tracks_stock, pet.pet_id, pet.pet_name
         FROM sales s LEFT JOIN customers c ON c.customer_id = s.customer_id
         LEFT JOIN sale_payments sp ON sp.sale_id = s.sale_id
         LEFT JOIN sale_items si ON si.sale_id = s.sale_id
         LEFT JOIN products p ON p.product_id = si.product_id
         LEFT JOIN pets pet ON pet.pet_id = si.pet_id
        ${customerCode ? 'WHERE c.customer_code = :customerCode' : ''}
        ORDER BY s.sold_at DESC, s.sale_id DESC`,
      customerCode ? { customerCode } : [], objectRows
    );
    const sales = new Map();
    for (const row of result.rows) {
      let sale = sales.get(row.SALE_ID);
      if (!sale) {
        sale = {
          id: row.RECEIPT_NUMBER, saleId: Number(row.SALE_ID), soldAt: new Date(row.SOLD_AT).toISOString(),
          status: row.STATUS, customerCode: row.CUSTOMER_CODE || null,
          customerName: [row.FIRST_NAME, row.LAST_NAME].filter(Boolean).join(' ') || 'ลูกค้าทั่วไป',
          paymentMethod: row.PAYMENT_METHOD === 'CASH' ? 'เงินสด' : 'พร้อมเพย์',
          subtotal: Number(row.SUBTOTAL), discount: Number(row.DISCOUNT_AMOUNT),
          netSales: Number(row.NET_SALES), tax: Number(row.VAT_AMOUNT), total: Number(row.TOTAL_AMOUNT), items: []
        };
        sales.set(row.SALE_ID, sale);
      }
      if (row.SALE_ITEM_ID != null) sale.items.push({
        id: Number(row.SALE_ITEM_ID), productCode: row.PRODUCT_CODE, name: row.PRODUCT_NAME_SNAPSHOT,
        productId: row.PRODUCT_CODE,
        type: row.TRACKS_STOCK === 'Y' ? 'สินค้า' : 'บริการ',
        unitName: row.UNIT_NAME_SNAPSHOT, quantity: Number(row.QUANTITY),
        unitPrice: Number(row.UNIT_PRICE), lineTotal: Number(row.LINE_TOTAL),
        unitCost: row.UNIT_COST_SNAPSHOT == null ? null : Number(row.UNIT_COST_SNAPSHOT),
        petId: row.PET_ID == null ? null : Number(row.PET_ID), petName: row.PET_NAME || null
      });
    }
    return [...sales.values()];
  });
}