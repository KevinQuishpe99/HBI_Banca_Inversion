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

async function runMigration() {
  if (
    !process.env.DB_HOST ||
    !process.env.DB_NAME ||
    process.env.DB_PASSWORD == null ||
    process.env.DB_PASSWORD === ''
  ) {
    console.error('Faltan variables DB_HOST, DB_NAME o DB_PASSWORD en .env o .env.local');
    process.exit(1);
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

  let client;
  try {
    client = await pool.connect();
    console.log('Conectado a la base de datos');

    const migrationPath = path.join(__dirname, 'migration-correos-enviados.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Ejecutando: tabla correos_enviados…');
    await client.query(migrationSQL);

    console.log('Migración completada: auditoría de correos disponible.');
  } catch (err) {
    console.error('Error en migración:', err);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

runMigration();
