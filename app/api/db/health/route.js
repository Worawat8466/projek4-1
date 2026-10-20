import { isOracleConfigured, withOracleConnection } from '../../../../src/server/oraclePool.js';

export const runtime = 'nodejs';

export async function GET() {
  if (!isOracleConfigured()) {
    return Response.json({ ok: false, database: 'not_configured' }, { status: 503 });
  }

  try {
    await withOracleConnection((connection) => connection.execute('SELECT 1 FROM dual'));
    return Response.json({ ok: true, database: 'oracle' });
  } catch {
    return Response.json({ ok: false, database: 'unavailable' }, { status: 503 });
  }
}
