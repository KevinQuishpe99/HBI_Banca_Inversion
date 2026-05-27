const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  let client;

  try {
    client = await pool.connect();
    console.log('✅ Conectado a la base de datos');

    // Leer el archivo de migración
    const migrationPath = path.join(__dirname, 'migration-case-fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Ejecutando migración de campos de casos...');

    // Ejecutar la migración
    await client.query(migrationSQL);

    console.log('✅ Migración completada exitosamente');
    console.log('\nNuevas columnas agregadas a la tabla cases:');
    console.log('  - advisor_name');
    console.log('  - document_file_name');
    console.log('  - odoo_code');
    console.log('  - client_provider');
    console.log('  - document_type');
    console.log('  - sharepoint_url');
    console.log('  - request_date');
    console.log('  - required_delivery_date');
    console.log('  - urgency_justification');
    console.log('  - signature_type');
    console.log('  - template_type');
    console.log('  - observations');

  } catch (error) {
    console.error('❌ Error ejecutando migración:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('\n✅ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
