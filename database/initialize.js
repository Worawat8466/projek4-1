import { readFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import oracledb from 'oracledb';
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const config = {
  user: process.env.DB_USER || process.env.ORACLE_USER,
  password: process.env.DB_PASSWORD || process.env.ORACLE_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING || process.env.ORACLE_CONNECT_STRING || (
    process.env.DB_HOST && process.env.DB_SERVICE_NAME
      ? `${process.env.DB_HOST}:${process.env.DB_PORT || '1521'}/${process.env.DB_SERVICE_NAME}`
      : ''
  )
};

const expectedTables = [
  'STAFF_ROLES', 'STAFF', 'CUSTOMERS', 'PETS', 'PRODUCT_CATEGORIES', 'PRODUCTS',
  'PRODUCT_UNITS', 'SUPPLIERS', 'PURCHASE_ORDERS', 'PURCHASE_ORDER_ITEMS',
  'INVENTORY_LOTS', 'SALES', 'SALE_ITEMS', 'SALE_LOT_ALLOCATIONS',
  'SALE_PAYMENTS', 'INVENTORY_MOVEMENTS', 'CLINIC_SETTINGS', 'AUDIT_LOGS'
];

function splitStatements(sql) {
  return sql
    .replace(/^\s*--.*$/gm, '')
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function main() {
  if (!config.user || !config.password || !config.connectString) {
    throw new Error('Set DB_USER, DB_PASSWORD and DB_CONNECT_STRING in .env.local first.');
  }

  const connection = await oracledb.getConnection(config);
  try {
    const result = await connection.execute(
      `SELECT table_name FROM user_tables WHERE table_name IN (${expectedTables.map((name) => `'${name}'`).join(', ')})`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const existingTables = new Set(result.rows.map((row) => row.TABLE_NAME));
    const existingExpectedCount = expectedTables.filter((name) => existingTables.has(name)).length;

    if (existingExpectedCount > 0 && existingExpectedCount < expectedTables.length) {
      throw new Error(`Partial TleClinic schema detected (${existingExpectedCount}/${expectedTables.length} tables). Inspect the database before continuing.`);
    }

    if (existingExpectedCount === 0) {
      const schema = await readFile(join(process.cwd(), 'database', 'schema.sql'), 'utf8');
      for (const statement of splitStatements(schema)) await connection.execute(statement);
      console.log(`Created ${expectedTables.length} TleClinic tables.`);
    } else {
      console.log('TleClinic schema already exists; DDL was not rerun.');
    }

    try {
      await connection.execute(`CREATE TABLE schema_migrations (
        migration_name VARCHAR2(200) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
      )`);
    } catch (error) {
      if (error.errorNum !== 955) throw error;
    }

    const migrationFiles = (await readdir(join(process.cwd(), 'database', 'migrations')))
      .filter((file) => file.endsWith('.sql'))
      .sort();
    for (const migrationName of migrationFiles) {
      const applied = await connection.execute(
        'SELECT COUNT(*) AS APPLIED_COUNT FROM schema_migrations WHERE migration_name = :migrationName',
        { migrationName },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (Number(applied.rows[0].APPLIED_COUNT) > 0) continue;
      const migration = await readFile(join(process.cwd(), 'database', 'migrations', migrationName), 'utf8');
      for (const statement of splitStatements(migration)) await connection.execute(statement);
      await connection.execute('INSERT INTO schema_migrations (migration_name) VALUES (:migrationName)', { migrationName });
      await connection.commit();
      console.log(`Applied migration ${migrationName}.`);
    }

    const seed = await readFile(join(process.cwd(), 'database', 'seed.sql'), 'utf8');
    for (const statement of splitStatements(seed)) await connection.execute(statement);
    await connection.commit();
    console.log('Seed roles and default clinic settings are ready.');
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error(`Database initialization failed: ${error.message}`);
  process.exitCode = 1;
});
