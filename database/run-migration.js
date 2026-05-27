/**
 * Script para ejecutar la migración de autenticación
 */
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false,
  },
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

async function runMigration() {
  console.log('============================================================');
  console.log('🔄 Ejecutando migración de autenticación');
  console.log('============================================================\n');

  const client = await pool.connect();
  
  try {
    // Leer el archivo de migración
    const migrationPath = path.join(__dirname, 'migration-auth.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Archivo de migración cargado');
    console.log('🚀 Ejecutando SQL...\n');

    // Ejecutar la migración
    await client.query(migrationSQL);

    console.log('✅ Migración ejecutada exitosamente\n');

    // Verificar cambios
    console.log('🔍 Verificando cambios...\n');

    // Verificar nueva columna en cases
    const casesCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'cases' AND column_name = 'current_area_role'
    `);
    
    if (casesCheck.rows.length > 0) {
      console.log('✅ Columna current_area_role agregada a tabla cases');
    }

    // Verificar tabla user_sessions
    const sessionsCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'user_sessions'
    `);
    
    if (sessionsCheck.rows.length > 0) {
      console.log('✅ Tabla user_sessions creada');
    }

    // Verificar función get_cases_for_user
    const functionCheck = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_name = 'get_cases_for_user'
    `);
    
    if (functionCheck.rows.length > 0) {
      console.log('✅ Función get_cases_for_user creada');
    }

    // Verificar vista cases_by_area
    const viewCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_name = 'cases_by_area'
    `);
    
    if (viewCheck.rows.length > 0) {
      console.log('✅ Vista cases_by_area creada');
    }

    console.log('\n============================================================');
    console.log('🎉 Migración completada exitosamente');
    console.log('============================================================');

  } catch (error) {
    console.error('\n❌ Error ejecutando migración:');
    console.error(error.message);
    
    if (error.message.includes('already exists')) {
      console.log('\n💡 Algunos elementos ya existen. Esto es normal si ya ejecutaste la migración.');
    }
    
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
