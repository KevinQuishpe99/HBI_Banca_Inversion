/**
 * Aplica schema-hbi-agente-financiacion.sql (requiere tablas base: usuarios).
 * Uso: npm run db:migrate-hbi
 */
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

  const sqlPath = path.join(__dirname, 'schema-hbi-agente-financiacion.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    await pool.query(sql);
    const seedPath = path.join(__dirname, 'seed-hbi-reglas.sql');
    if (fs.existsSync(seedPath)) {
      await pool.query(fs.readFileSync(seedPath, 'utf8'));
      console.log('Reglas HBI (seed) aplicadas.');
    }
    console.log('Migración HBI aplicada correctamente.');
  } catch (err) {
    console.error('Error en migración HBI:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
