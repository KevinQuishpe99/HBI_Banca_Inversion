/**
 * Script para probar la conexión con diferentes formatos de contraseña
 * Ejecutar con: node test-password.js
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

async function testConnection(password, description) {
  console.log(`\n${colors.blue}🔍 Probando: ${description}${colors.reset}`);
  console.log(`   Contraseña: "${password}"`);
  
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: password,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    console.log(`${colors.green}✅ ¡CONEXIÓN EXITOSA!${colors.reset}`);
    
    const result = await client.query('SELECT current_database(), current_user');
    console.log(`   Base de datos: ${result.rows[0].current_database}`);
    console.log(`   Usuario: ${result.rows[0].current_user}`);
    
    client.release();
    await pool.end();
    return true;
  } catch (error) {
    console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
    await pool.end();
    return false;
  }
}

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${colors.blue}🔐 Test de Contraseñas - PostgreSQL Azure${colors.reset}`);
  console.log(`${'='.repeat(60)}`);
  
  console.log(`\n${colors.blue}📋 Configuración actual:${colors.reset}`);
  console.log(`   Host: ${process.env.DB_HOST}`);
  console.log(`   Puerto: ${process.env.DB_PORT}`);
  console.log(`   Base de datos: ${process.env.DB_NAME}`);
  console.log(`   Usuario: ${process.env.DB_USER}`);
  console.log(`   Contraseña en .env.local: "${process.env.DB_PASSWORD}"`);
  
  // Probar diferentes formatos
  const passwordsToTest = [
    { password: process.env.DB_PASSWORD, description: 'Contraseña desde .env.local' },
    { password: 'EnyOcyBZ#', description: 'Contraseña con # literal' },
    { password: 'EnyOcyBZ%23', description: 'Contraseña con %23 (URL encoded)' },
    { password: 'EnyOcyBZ', description: 'Contraseña sin #' },
  ];
  
  let success = false;
  
  for (const test of passwordsToTest) {
    const result = await testConnection(test.password, test.description);
    if (result) {
      success = true;
      console.log(`\n${colors.green}${'='.repeat(60)}${colors.reset}`);
      console.log(`${colors.green}✨ ¡Contraseña correcta encontrada!${colors.reset}`);
      console.log(`${colors.green}${'='.repeat(60)}${colors.reset}`);
      console.log(`\n${colors.yellow}📝 Actualiza tu .env.local con:${colors.reset}`);
      console.log(`${colors.yellow}DB_PASSWORD=${test.password}${colors.reset}\n`);
      break;
    }
  }
  
  if (!success) {
    console.log(`\n${colors.red}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.red}❌ Ninguna contraseña funcionó${colors.reset}`);
    console.log(`${colors.red}${'='.repeat(60)}${colors.reset}`);
    console.log(`\n${colors.yellow}🔍 Posibles causas:${colors.reset}`);
    console.log(`   1. La contraseña cambió en Azure`);
    console.log(`   2. El usuario no existe o no tiene permisos`);
    console.log(`   3. La base de datos no existe`);
    console.log(`   4. Tu IP no está permitida en el firewall`);
    console.log(`\n${colors.yellow}📋 Pasos a seguir:${colors.reset}`);
    console.log(`   1. Ve a Azure Portal`);
    console.log(`   2. Busca: data-base-src.postgres.database.azure.com`);
    console.log(`   3. Ve a "Connection strings" o "Configuración"`);
    console.log(`   4. Verifica el usuario y contraseña`);
    console.log(`   5. Ve a "Connection security" y agrega tu IP`);
    console.log(`\n${colors.yellow}🌐 Tu IP actual:${colors.reset}`);
    
    // Intentar obtener IP pública
    try {
      const https = require('https');
      https.get('https://api.ipify.org?format=json', (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          const ip = JSON.parse(data).ip;
          console.log(`   ${ip}`);
          console.log(`\n${colors.yellow}   Agrega esta IP en Azure Portal → Connection security${colors.reset}\n`);
        });
      });
    } catch (e) {
      console.log(`   No se pudo obtener la IP automáticamente`);
    }
  }
}

main().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});
