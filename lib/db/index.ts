import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { usaDatosQuemadosHbi } from '@/lib/hbi/mock-config';

const ERROR_MODO_DEMO =
  'Modo demo HBI: PostgreSQL deshabilitado. La app usa datos quemados en código.';

function shouldUseSsl(): boolean {
  const raw = (process.env.DB_SSL ?? '').trim().toLowerCase();
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  // Default: si no se especifica, NO usar SSL para Postgres local
  return false;
}

const isDev = process.env.NODE_ENV === 'development';

const POOL_MAX_CAP = 20;

function getPoolMax(): number {
  const raw = process.env.DB_POOL_MAX?.trim();
  if (raw) {
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= POOL_MAX_CAP) return n;
    console.warn(
      `[pg] DB_POOL_MAX="${raw}" no válido (usa 1–${POOL_MAX_CAP}); se aplica el valor por defecto`
    );
  }
  return 2;
}

function getConnectionTimeoutMs(): number {
  const raw = process.env.DB_CONNECTION_TIMEOUT_MS?.trim();
  if (raw) {
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n) && n >= 2000 && n <= 120000) return n;
    console.warn(`[pg] DB_CONNECTION_TIMEOUT_MS="${raw}" no válido (2000–120000); se usa el valor por defecto`);
  }
  return isDev ? 25_000 : 12_000;
}

declare global {
  var __conwarePgPool: Pool | undefined;
}

function ensurePool(): Pool {
  if (usaDatosQuemadosHbi()) {
    throw new Error(ERROR_MODO_DEMO);
  }
  if (global.__conwarePgPool) {
    return global.__conwarePgPool;
  }
  const pool = createPool();
  if (isDev) global.__conwarePgPool = pool;
  pool.on('error', (err) => {
    console.error('[pg] pool', err);
  });
  return pool;
}

function createPool() {
  const max = getPoolMax();
  return new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max,
    min: 0,
    // En dev, cerrar conexiones ociosas rápido evita agotar slots por hot-reload
    idleTimeoutMillis: isDev ? 15 * 1000 : 10000,
    connectionTimeoutMillis: getConnectionTimeoutMs(),
    statement_timeout: 30000,
    query_timeout: 30000,
    allowExitOnIdle: true,
    ssl: shouldUseSsl() ? { rejectUnauthorized: false } : false,
  });
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  if (usaDatosQuemadosHbi()) {
    throw new Error(ERROR_MODO_DEMO);
  }

  const pool = ensurePool();
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development' && process.env.DEBUG_DB === '1') {
      console.log('[pg]', res.rowCount, `${duration}ms`);
    }
    
    return res;
  } catch (error) {
    console.error('[pg] query', error);
    throw error;
  }
}

export async function getClient(): Promise<PoolClient> {
  return await ensurePool().connect();
}

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

export async function closePool(): Promise<void> {
  if (global.__conwarePgPool) {
    await global.__conwarePgPool.end();
    global.__conwarePgPool = undefined;
  }
}

export default ensurePool;

export function isLikelyDbConnectivityError(error: unknown): boolean {
  const parts: string[] = [];
  if (error instanceof Error) {
    parts.push(error.message);
    if (error.cause instanceof Error) parts.push(error.cause.message);
  } else {
    parts.push(String(error));
  }
  const msg = parts.join(' ');
  return /timeout|terminated unexpectedly|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|connection refused|getaddrinfo/i.test(
    msg
  );
}
