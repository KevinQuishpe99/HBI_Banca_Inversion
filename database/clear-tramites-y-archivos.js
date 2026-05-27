/**
 * Pone a cero solo lo relacionado con trámites:
 *  1) PostgreSQL: elimina trámites, filas de archivos y tablas ligadas (no usuarios ni catálogos).
 *  2) Azure Blob: elimina todos los blobs con prefijo `case-` (misma convención que lib/azure/blob-storage.ts).
 *
 * No hace nada más (no migra, no toca enrutamiento ni áreas).
 *
 * Requiere en .env / .env.local: DB_*.
 * Requiere para el blob: AZURE_STORAGE_ACCOUNT, AZURE_STORAGE_KEY, AZURE_CONTAINER_NAME (opcional; default gestion-archivos).
 *
 * Uso:
 *   npm run db:clear-tramites
 *   npm run db:clear-tramites -- --skip-azure   (solo base; p. ej. sin credenciales Azure en local)
 */
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { BlobServiceClient } = require('@azure/storage-blob');

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

/** Prefijo de rutas de expedientes en el contenedor (case-{uuid}/...) */
const BLOB_PREFIX = 'case-';

async function purgeAzureCaseBlobs() {
  const account = process.env.AZURE_STORAGE_ACCOUNT;
  const key = process.env.AZURE_STORAGE_KEY;
  const containerName = process.env.AZURE_CONTAINER_NAME || 'gestion-archivos';
  if (!account || !key) {
    throw new Error('Faltan AZURE_STORAGE_ACCOUNT o AZURE_STORAGE_KEY en el entorno.');
  }
  const connectionString = `DefaultEndpointsProtocol=https;AccountName=${account};AccountKey=${key};EndpointSuffix=core.windows.net`;
  const service = BlobServiceClient.fromConnectionString(connectionString);
  const container = service.getContainerClient(containerName);
  const exists = await container.exists();
  if (!exists) {
    console.log(`   Contenedor "${containerName}" no existe; nada que borrar en blob.\n`);
    return 0;
  }
  let n = 0;
  for await (const blob of container.listBlobsFlat({ prefix: BLOB_PREFIX })) {
    await container.deleteBlob(blob.name);
    n++;
    if (n % 200 === 0) process.stdout.write(`   … ${n} blobs\n`);
  }
  return n;
}

async function runSqlWipe() {
  const sqlPath = path.join(__dirname, 'clear-tramites-y-archivos.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = await pool.connect();
  try {
    await client.query(sql);
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const skipAzure = process.argv.includes('--skip-azure');

  if (!process.env.DB_HOST || !process.env.DB_NAME || process.env.DB_PASSWORD == null || process.env.DB_PASSWORD === '') {
    console.error('Error: faltan DB_HOST, DB_NAME o DB_PASSWORD en .env / .env.local');
    process.exit(1);
  }

  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  Vacíar trámites: PostgreSQL + Azure Blob (solo expedientes)');
  console.log('══════════════════════════════════════════════════════════');
  console.log('');

  console.log('[1/2] PostgreSQL: clear-tramites-y-archivos.sql …');
  try {
    await runSqlWipe();
    console.log('      Hecho (trámites y tablas ligadas vacías).\n');
  } catch (e) {
    console.error('      Error SQL:', e.message || e);
    process.exit(1);
  }

  if (skipAzure) {
    console.log('[2/2] Azure Blob: omitido (--skip-azure).\n');
    console.log('Listo.\n');
    return;
  }

  console.log(`[2/2] Azure Blob: borrando prefijo "${BLOB_PREFIX}" …`);
  try {
    const n = await purgeAzureCaseBlobs();
    console.log(`      Hecho (${n} blob(s) eliminados).\n`);
  } catch (e) {
    console.error('      Error Azure:', e.message || e);
    console.error('\nSi no tiene Storage en este entorno, ejecute: npm run db:clear-tramites -- --skip-azure\n');
    process.exit(1);
  }

  console.log('Listo: base y contenedor sin archivos de trámites.\n');
}

main();
