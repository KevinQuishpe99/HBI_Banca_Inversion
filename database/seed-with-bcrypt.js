/**
 * Inserta usuarios con contraseñas hasheadas (bcrypt).
 * Uso: npm run db:seed
 * Requiere DB_* en .env o .env.local (no usar credenciales por defecto en código).
 */
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

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
});

const users = [
  { email: 'admin@sistema.com', password: 'Admin123!', firstName: 'Admin', lastName: 'Sistema', role: 'ADMIN' },
  { email: 'comercial@sistema.com', password: 'Comercial123!', firstName: 'Usuario', lastName: 'Comercial', role: 'COMERCIAL' },
  { email: 'tecnica@sistema.com', password: 'Tecnica123!', firstName: 'Usuario', lastName: 'Técnica', role: 'TECNICA' },
  { email: 'financiera@sistema.com', password: 'Financiera123!', firstName: 'Usuario', lastName: 'Financiera', role: 'FINANCIERA' },
  { email: 'legal@sistema.com', password: 'Legal123!', firstName: 'Usuario', lastName: 'Legal', role: 'LEGAL' },
  { email: 'usuario@sistema.com', password: 'Usuario123!', firstName: 'Usuario', lastName: 'Normal', role: 'USER' },
];

async function seedUsers() {
  if (!process.env.DB_HOST || !process.env.DB_NAME || process.env.DB_PASSWORD == null || process.env.DB_PASSWORD === '') {
    console.error('Configura DB_HOST, DB_NAME, DB_USER y DB_PASSWORD en .env o .env.local');
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    console.log('Iniciando seed de usuarios...');

    for (const user of users) {
      const passwordHash = await bcrypt.hash(user.password, 10);

      await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             first_name = EXCLUDED.first_name,
             last_name = EXCLUDED.last_name,
             role = EXCLUDED.role`,
        [user.email, passwordHash, user.firstName, user.lastName, user.role]
      );

      console.log(`Usuario listo: ${user.email} (${user.role})`);
    }

    console.log('\nSeed completado. Cambia las contraseñas en producción.\n');
  } catch (error) {
    console.error('Error durante el seed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedUsers().catch((error) => {
  console.error('Error fatal:', error);
  process.exit(1);
});
