import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

// Opción 1: Usar DATABASE_URL si está disponible
const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}?sslmode=disable`;

const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Manejo de errores del pool
pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL', err);
  process.exit(-1);
});

/**
 * Ejecuta una query con parámetros
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Query ejecutada:', { text, duration, rows: res.rowCount });
    }
    
    return res;
  } catch (error) {
    console.error('Error en query:', { text, error });
    throw error;
  }
}

/**
 * Obtiene un cliente del pool para transacciones
 */
export async function getClient(): Promise<PoolClient> {
  return await pool.connect();
}

/**
 * Ejecuta múltiples queries en una transacción
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Cierra el pool de conexiones
 */
export async function closePool(): Promise<void> {
  await pool.end();
}

export default pool;
