/**
 * Aplica database/migration-area-supervisor-1-1.sql (columna area_config.supervisor_id + triggers).
 * Uso: npm run db:migrate-area-supervisor
 */
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

function shouldUseSsl() {
  const raw = (process.env.DB_SSL ?? '').trim().toLowerCase();
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return false;
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: shouldUseSsl() ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '30000', 10),
});

async function main() {
  if (!process.env.DB_HOST || !process.env.DB_NAME || process.env.DB_PASSWORD == null || process.env.DB_PASSWORD === '') {
    console.error('Faltan variables DB_* en .env o .env.local');
    process.exit(1);
  }
  const client = await pool.connect();
  try {
    const sqlPath = path.join(__dirname, 'migration-area-supervisor-1-1.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sql);
    console.log('OK: migration-area-supervisor-1-1 aplicada (supervisor_id en area_config).');
    const check = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'area_config' AND column_name = 'supervisor_id'`
    );
    console.log('Verificación columna supervisor_id:', check.rows.length ? 'existe' : 'NO encontrada');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
