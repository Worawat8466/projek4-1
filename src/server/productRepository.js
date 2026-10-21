import oracledb from 'oracledb';
import { withOracleConnection, withOracleTransaction } from './oraclePool.js';

function mapProduct(row, unitRows) {
  const units = unitRows
    .filter((unit) => unit.PRODUCT_ID === row.PRODUCT_ID)
    .sort((first, second) => Number(second.BASE_UNITS_PER_UNIT) - Number(first.BASE_UNITS_PER_UNIT));
  const packUnit = units.find((unit) => Number(unit.BASE_UNITS_PER_UNIT) > 1) || units[0];
  const tracksStock = row.TRACKS_STOCK === 'Y';
  return {
    id: row.PRODUCT_CODE,
    name: row.PRODUCT_NAME,
    category: row.CATEGORY_NAME || 'ทั่วไป',
    type: tracksStock ? 'สินค้า' : 'บริการ',
    baseUnit: row.BASE_UNIT,
    packUnit: tracksStock ? packUnit?.UNIT_NAME || row.BASE_UNIT : row.BASE_UNIT,
    multiplier: tracksStock ? Number(packUnit?.BASE_UNITS_PER_UNIT) || 1 : 1,
    salePrice: Number(row.BASE_SALE_PRICE),
    costPrice: row.BASE_COST == null ? null : Number(row.BASE_COST),
    minimumStock: Number(row.MIN_STOCK),
    tracksStock,
    barcode: row.BARCODE || ''
  };
}

export async function listProducts() {
  return withOracleConnection(async (connection) => {
    const productsResult = await connection.execute(
      `SELECT p.product_id, p.product_code, p.barcode, p.product_name, p.product_type,
              p.base_unit, p.base_sale_price, p.base_cost, p.min_stock, p.tracks_stock,
              c.category_name
         FROM products p
         LEFT JOIN product_categories c ON c.category_id = p.category_id
        WHERE p.is_active = 'Y'
        ORDER BY p.product_name`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (productsResult.rows.length === 0) return [];

    const unitResult = await connection.execute(
      `SELECT unit_id, product_id, unit_name, base_units_per_unit, sale_price, is_default_sale_unit
         FROM product_units
        WHERE product_id IN (${productsResult.rows.map((row) => Number(row.PRODUCT_ID)).join(',')})
        ORDER BY base_units_per_unit DESC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return productsResult.rows.map((row) => mapProduct(row, unitResult.rows));
  });
}

async function findOrCreateCategory(connection, categoryName) {
  if (!categoryName?.trim()) return null;
  const found = await connection.execute(
    'SELECT category_id FROM product_categories WHERE category_name = :categoryName AND is_active = \'Y\'',
    { categoryName: categoryName.trim() },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );
  if (found.rows[0]) return found.rows[0].CATEGORY_ID;
  await connection.execute(
    'INSERT INTO product_categories (category_name) VALUES (:categoryName)',
    { categoryName: categoryName.trim() }
  );
  const inserted = await connection.execute(
    'SELECT category_id FROM product_categories WHERE category_name = :categoryName AND is_active = \'Y\'',
    { categoryName: categoryName.trim() },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );
  return inserted.rows[0]?.CATEGORY_ID || null;
}

async function getProductByCode(connection, productCode) {
  const result = await connection.execute(
    `SELECT p.product_id, p.product_code, p.barcode, p.product_name, p.product_type,
            p.base_unit, p.base_sale_price, p.base_cost, p.min_stock, p.tracks_stock,
            c.category_name
       FROM products p
       LEFT JOIN product_categories c ON c.category_id = p.category_id
      WHERE p.product_code = :productCode AND p.is_active = 'Y'`,
    { productCode },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );
  return result.rows[0] || null;
}

async function getProductUnits(connection, productId) {
  const result = await connection.execute(
    `SELECT unit_id, product_id, unit_name, base_units_per_unit, sale_price, is_default_sale_unit
       FROM product_units WHERE product_id = :productId
      ORDER BY base_units_per_unit DESC`,
    { productId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );
  return result.rows;
}

export async function createProduct(input) {
  return withOracleTransaction(async (connection) => {
    let stage = 'category';
    try {
    const categoryId = await findOrCreateCategory(connection, input.category);
    const tracksStock = input.type !== 'บริการ';
    const baseCost = input.costPrice == null || input.costPrice === '' ? null : Number(input.costPrice);
    stage = 'insert-product';
    const productInsert = await connection.execute(
      `INSERT INTO products
         (category_id, product_code, barcode, product_name, product_type, base_unit,
          base_sale_price, base_cost, min_stock, tracks_stock)
       VALUES (:categoryId, :productCode, :barcode, :productName, :productType, :baseUnit,
               :salePrice, :baseCost, :minimumStock, :tracksStock)
       RETURNING product_id INTO :productId`,
      {
        categoryId,
        productCode: input.id.trim(),
        barcode: input.barcode?.trim() || input.id.trim(),
        productName: input.name.trim(),
        productType: tracksStock ? 'PRODUCT' : 'SERVICE',
        baseUnit: input.baseUnit.trim(),
        salePrice: Number(input.salePrice),
        baseCost,
        minimumStock: tracksStock ? Number(input.minimumStock) || 0 : 0,
        tracksStock: tracksStock ? 'Y' : 'N',
        productId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      }
    );
    const productId = productInsert.outBinds.productId[0];
    const multiplier = tracksStock ? Number(input.multiplier) || 1 : 1;
    const baseUnit = input.baseUnit.trim();
    const packUnit = tracksStock ? input.packUnit.trim() : baseUnit;
    stage = 'insert-base-unit';
    await connection.execute(
      `INSERT INTO product_units (product_id, unit_name, base_units_per_unit, sale_price, is_default_sale_unit)
       VALUES (:productId, :unitName, 1, :salePrice, 'Y')`,
      { productId, unitName: baseUnit, salePrice: Number(input.salePrice) }
    );
    if (tracksStock && packUnit.toLowerCase() !== baseUnit.toLowerCase()) {
      stage = 'insert-pack-unit';
      await connection.execute(
        `INSERT INTO product_units (product_id, unit_name, base_units_per_unit, sale_price, is_default_sale_unit)
         VALUES (:productId, :unitName, :multiplier, :salePrice, 'N')`,
        { productId, unitName: packUnit, multiplier, salePrice: Number(input.salePrice) * multiplier }
      );
    }
    stage = 'select-created-product';
    const row = await getProductByCode(connection, input.id.trim());
    return mapProduct(row, await getProductUnits(connection, productId));
    } catch (error) {
      error.productStage = stage;
      throw error;
    }
  });
}

export async function updateProduct(productCode, input) {
  return withOracleTransaction(async (connection) => {
    const existing = await getProductByCode(connection, productCode);
    if (!existing) return null;
    const tracksStock = input.type !== 'บริการ';
    const categoryId = await findOrCreateCategory(connection, input.category);
    const baseCost = input.costPrice == null || input.costPrice === '' ? null : Number(input.costPrice);
    await connection.execute(
      `UPDATE products
          SET category_id = :categoryId, barcode = :barcode, product_name = :productName,
              product_type = :productType, base_unit = :baseUnit, base_sale_price = :salePrice,
              base_cost = :baseCost, min_stock = :minimumStock, tracks_stock = :tracksStock,
              updated_at = SYSTIMESTAMP
        WHERE product_code = :productCode`,
      {
        categoryId,
        barcode: input.barcode?.trim() || input.id.trim(),
        productName: input.name.trim(),
        productType: tracksStock ? 'PRODUCT' : 'SERVICE',
        baseUnit: input.baseUnit.trim(),
        salePrice: Number(input.salePrice),
        baseCost,
        minimumStock: tracksStock ? Number(input.minimumStock) || 0 : 0,
        tracksStock: tracksStock ? 'Y' : 'N',
        productCode
      }
    );
    const productId = existing.PRODUCT_ID;
    const multiplier = tracksStock ? Number(input.multiplier) || 1 : 1;
    const baseUnit = input.baseUnit.trim();
    const packUnit = tracksStock ? input.packUnit.trim() : baseUnit;
    await connection.execute('DELETE FROM product_units WHERE product_id = :productId', { productId });
    await connection.execute(
      `INSERT INTO product_units (product_id, unit_name, base_units_per_unit, sale_price, is_default_sale_unit)
       VALUES (:productId, :unitName, 1, :salePrice, 'Y')`,
      { productId, unitName: baseUnit, salePrice: Number(input.salePrice) }
    );
    if (tracksStock && packUnit.toLowerCase() !== baseUnit.toLowerCase()) {
      await connection.execute(
        `INSERT INTO product_units (product_id, unit_name, base_units_per_unit, sale_price, is_default_sale_unit)
         VALUES (:productId, :unitName, :multiplier, :salePrice, 'N')`,
        { productId, unitName: packUnit, multiplier, salePrice: Number(input.salePrice) * multiplier }
      );
    }
    return mapProduct(await getProductByCode(connection, productCode), await getProductUnits(connection, productId));
  });
}

export async function deactivateProduct(productCode) {
  return withOracleTransaction(async (connection) => {
    const result = await connection.execute(
      `UPDATE products SET is_active = 'N', updated_at = SYSTIMESTAMP WHERE product_code = :productCode AND is_active = 'Y'`,
      { productCode }
    );
    return result.rowsAffected > 0;
  });
}
