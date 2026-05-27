/**
 * Alinea configuracion_areas con la app: nombre_area y sin codigo.
 * Uso: npm run db:migrate-configuracion-areas-align
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
    const sqlPath = path.join(__dirname, 'migration-configuracion-areas-align-app.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Ejecutando migration-configuracion-areas-align-app.sql ...');
    await client.query(sql);
    const check = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'configuracion_areas'
        AND column_name IN ('nombre_area', 'nombre', 'codigo')
      ORDER BY column_name
    `);
    console.log('Columnas relevantes ahora:', check.rows.map((r) => r.column_name).join(', ') || '(ninguna de la lista)');
    console.log('OK: configuracion_areas alineada con la aplicación.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
