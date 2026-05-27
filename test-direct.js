/**
 * Test directo sin dotenv
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: 'data-base-src.postgres.database.azure.com',
  port: 5432,
  database: 'gestion_archivos_db',
  user: 'azureuser',
  password: 'EnyOcyBZ#', // Contraseña directa
  ssl: {
    rejectUnauthorized: false
  }
});

async function test() {
  try {
    const client = await pool.connect();
    console.log('✅ Conexión exitosa!');
    
    const result = await client.query('SELECT current_database(), current_user, version()');
    console.log('Base de datos:', result.rows[0].current_database);
    console.log('Usuario:', result.rows[0].current_user);
    console.log('Versión:', result.rows[0].version.split(',')[0]);
    
    // Verificar tablas
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\nTablas encontradas:', tables.rows.length);
    tables.rows.forEach(row => {
      console.log('  -', row.table_name);
    });
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
  }
}

test();
