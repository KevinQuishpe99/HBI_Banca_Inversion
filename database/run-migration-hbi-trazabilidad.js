const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  const sql = fs.readFileSync(
    path.join(__dirname, 'migration-hbi-trazabilidad-correos.sql'),
    'utf8'
  );
  try {
    await pool.query(sql);
    console.log('Migración trazabilidad HBI (correos) aplicada.');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
