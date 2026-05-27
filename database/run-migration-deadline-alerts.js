/**
 * Alertas por fecha límite: app_settings + case_deadline_alerts + notification_type.
 * Uso: node database/run-migration-deadline-alerts.js
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
    const sqlPath = path.join(__dirname, 'migration-deadline-alerts.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sql);
    console.log('OK: migration-deadline-alerts aplicada.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
