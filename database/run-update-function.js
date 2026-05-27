const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function updateFunction() {
  const client = await pool.connect();
  try {
    console.log('✅ Conectado a la base de datos');
    
    const sql = fs.readFileSync(
      path.join(__dirname, 'update-get-cases-function.sql'),
      'utf8'
    );
    
    console.log('📝 Actualizando función get_cases_for_user...');
    await client.query(sql);
    
    console.log('✅ Función actualizada exitosamente');
    console.log('\nLa función ahora retorna todos los campos del formulario:');
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
    console.error('❌ Error actualizando función:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

updateFunction()
  .then(() => {
    console.log('\n✅ Proceso completado');
    console.log('\n⚠️  IMPORTANTE: Crea un nuevo caso para ver todos los campos.');
    console.log('   Los casos existentes pueden no tener datos en los campos nuevos.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
