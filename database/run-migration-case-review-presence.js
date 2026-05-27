/**
 * Ejecuta database/migration-case-review-presence.sql
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
  connectionTimeoutMillis: 30000,
});

async function main() {
  if (!process.env.DB_HOST || !process.env.DB_NAME || process.env.DB_PASSWORD == null || process.env.DB_PASSWORD === '') {
    console.error('Faltan variables DB_HOST, DB_NAME, DB_PASSWORD (y opcionalmente DB_USER) en .env o .env.local');
    process.exit(1);
  }
  const client = await pool.connect();
  try {
    const sqlPath = path.join(__dirname, 'migration-case-review-presence.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sql);
    console.log('OK: migration-case-review-presence aplicada');

    const r = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'case_review_presence'
      ORDER BY ordinal_position
    `);
    console.log('Columnas case_review_presence:', r.rows.map((x) => x.column_name).join(', '));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
