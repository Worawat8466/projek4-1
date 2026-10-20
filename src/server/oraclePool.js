import oracledb from 'oracledb';

const globalForOracle = globalThis;
let poolPromise = globalForOracle.__tleClinicOraclePool || null;

export function isOracleConfigured() {
  return Boolean(process.env.ORACLE_USER && process.env.ORACLE_PASSWORD && process.env.ORACLE_CONNECT_STRING);
}

export async function getOraclePool() {
  if (!isOracleConfigured()) {
    const error = new Error('Oracle database is not configured');
    error.code = 'ORACLE_NOT_CONFIGURED';
    throw error;
  }

  if (!poolPromise) {
    poolPromise = oracledb.createPool({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECT_STRING,
      poolMin: Math.max(0, Number(process.env.ORACLE_POOL_MIN) || 1),
      poolMax: Math.max(1, Number(process.env.ORACLE_POOL_MAX) || 5),
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
