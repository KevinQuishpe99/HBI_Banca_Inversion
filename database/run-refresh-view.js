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

async function refreshView() {
  const client = await pool.connect();
  try {
    console.log('✅ Conectado a la base de datos');
    
    const sql = fs.readFileSync(
      path.join(__dirname, 'refresh-case-view.sql'),
      'utf8'
    );
    
    console.log('📝 Refrescando vista cases_with_creator...');
    await client.query(sql);
    
    console.log('✅ Vista refrescada exitosamente');
  } catch (error) {
    console.error('❌ Error refrescando vista:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

refreshView()
  .then(() => {
    console.log('✅ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
