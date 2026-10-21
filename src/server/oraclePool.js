import oracledb from 'oracledb';

const globalForOracle = globalThis;
let poolPromise = globalForOracle.__tleClinicOraclePool || null;

function getOracleConfig() {
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || '1521';
  const serviceName = process.env.DB_SERVICE_NAME;
  return {
    user: process.env.DB_USER || process.env.ORACLE_USER,
    password: process.env.DB_PASSWORD || process.env.ORACLE_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING || process.env.ORACLE_CONNECT_STRING || (host && serviceName ? `${host}:${port}/${serviceName}` : '')
  };
}

export function isOracleConfigured() {
  const config = getOracleConfig();
  return Boolean(config.user && config.password && config.connectString);
}

export async function getOraclePool() {
  if (!isOracleConfigured()) {
    const error = new Error('Oracle database is not configured');
    error.code = 'ORACLE_NOT_CONFIGURED';
    throw error;
  }

  if (!poolPromise) {
    const config = getOracleConfig();
    poolPromise = oracledb.createPool({
      ...config,
      poolMin: Math.max(0, Number(process.env.DB_POOL_MIN || process.env.ORACLE_POOL_MIN) || 1),
      poolMax: Math.max(1, Number(process.env.DB_POOL_MAX || process.env.ORACLE_POOL_MAX) || 5),
      poolIncrement: 1
    }).catch((error) => {
      poolPromise = null;
      globalForOracle.__tleClinicOraclePool = null;
      throw error;
    });
    globalForOracle.__tleClinicOraclePool = poolPromise;
  }

  return poolPromise;
}

export async function withOracleConnection(callback) {
  const pool = await getOraclePool();
  const connection = await pool.getConnection();
  try {
    return await callback(connection);
  } finally {
    await connection.close();
  }
}

export async function withOracleTransaction(callback) {
  const pool = await getOraclePool();
  const connection = await pool.getConnection();
  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}
