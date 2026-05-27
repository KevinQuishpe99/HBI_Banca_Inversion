/**
 * Script para verificar que todo esté configurado correctamente
 * Ejecutar con: node check-setup.js
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

console.log(`\n${colors.blue}🔍 Verificando configuración del proyecto...${colors.reset}\n`);

// Verificar archivos críticos
const criticalFiles = [
  'app/(dashboard)/page.tsx',
  'app/(dashboard)/layout.tsx',
  'app/providers.tsx',
  'components/cases/CaseCard.tsx',
  'hooks/useCases.ts',
  'services/case.service.ts',
  'lib/db/index.ts',
  'package.json',
];

let allFilesExist = true;

console.log(`${colors.blue}📁 Archivos críticos:${colors.reset}`);
criticalFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, file));
  if (exists) {
    console.log(`${colors.green}✓${colors.reset} ${file}`);
  } else {
    console.log(`${colors.red}✗${colors.reset} ${file} ${colors.red}(FALTA)${colors.reset}`);
    allFilesExist = false;
  }
});
const envOk =
  fs.existsSync(path.join(__dirname, '.env.local')) || fs.existsSync(path.join(__dirname, '.env'));
if (envOk) {
  console.log(`${colors.green}✓${colors.reset} .env o .env.local`);
} else {
  console.log(`${colors.red}✗${colors.reset} .env / .env.local ${colors.red}(FALTA)${colors.reset}`);
  allFilesExist = false;
}

// Verificar node_modules
console.log(`\n${colors.blue}📦 Dependencias:${colors.reset}`);
const nodeModulesExists = fs.existsSync(path.join(__dirname, 'node_modules'));
if (nodeModulesExists) {
  console.log(`${colors.green}✓${colors.reset} node_modules existe`);
  
  // Verificar dependencias críticas
  const criticalDeps = [
    '@tanstack/react-query',
    '@azure/storage-blob',
    'pg',
    'zod',
    'bcryptjs',
    'date-fns',
    'lucide-react',
  ];
  
  criticalDeps.forEach(dep => {
    const depPath = path.join(__dirname, 'node_modules', dep);
    const exists = fs.existsSync(depPath);
    if (exists) {
      console.log(`${colors.green}  ✓${colors.reset} ${dep}`);
    } else {
      console.log(`${colors.red}  ✗${colors.reset} ${dep} ${colors.red}(FALTA)${colors.reset}`);
      allFilesExist = false;
    }
  });
} else {
  console.log(`${colors.red}✗${colors.reset} node_modules no existe`);
  console.log(`${colors.yellow}  → Ejecuta: npm install${colors.reset}`);
  allFilesExist = false;
}

// Verificar .env.local o .env
console.log(`\n${colors.blue}⚙️  Variables de entorno:${colors.reset}`);
const envLocalPath = path.join(__dirname, '.env.local');
const envPathRoot = path.join(__dirname, '.env');
const envPath = fs.existsSync(envLocalPath) ? envLocalPath : envPathRoot;
if (fs.existsSync(envPath)) {
  console.log(`${colors.green}✓${colors.reset} ${path.basename(envPath)} existe`);
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const requiredVars = [
    'DB_HOST',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'AZURE_STORAGE_ACCOUNT',
    'AZURE_STORAGE_KEY',
    'AZURE_CONTAINER_NAME',
  ];
  
  requiredVars.forEach(varName => {
    if (envContent.includes(`${varName}=`) && !envContent.includes(`${varName}=\n`)) {
      console.log(`${colors.green}  ✓${colors.reset} ${varName}`);
    } else {
      console.log(`${colors.yellow}  ⚠${colors.reset} ${varName} ${colors.yellow}(vacío o falta)${colors.reset}`);
    }
  });
} else {
  console.log(`${colors.red}✗${colors.reset} Ni .env.local ni .env existen`);
  console.log(`${colors.yellow}  → Copia .env.example a .env o .env.local y configúralo${colors.reset}`);
  allFilesExist = false;
}

// Verificar carpeta .next
console.log(`\n${colors.blue}🏗️  Build:${colors.reset}`);
const nextPath = path.join(__dirname, '.next');
if (fs.existsSync(nextPath)) {
  console.log(`${colors.green}✓${colors.reset} .next existe (proyecto compilado)`);
  console.log(`${colors.yellow}  💡 Si ves la página por defecto, elimina .next y reinicia${colors.reset}`);
} else {
  console.log(`${colors.yellow}⚠${colors.reset} .next no existe (normal en primera ejecución)`);
}

// Resumen
console.log(`\n${'='.repeat(60)}`);
if (allFilesExist && nodeModulesExists) {
  console.log(`${colors.green}✅ Todo está configurado correctamente${colors.reset}`);
  console.log(`\n${colors.blue}Siguiente paso:${colors.reset}`);
  console.log(`  1. Verificación completa: ${colors.yellow}npm run verify${colors.reset}`);
  console.log(`  2. Inicia el servidor: ${colors.yellow}npm run dev${colors.reset}`);
} else {
  console.log(`${colors.red}⚠️  Hay problemas de configuración${colors.reset}`);
  console.log(`\n${colors.blue}Pasos a seguir:${colors.reset}`);
  if (!nodeModulesExists) {
    console.log(`  1. ${colors.yellow}npm install${colors.reset}`);
  }
  if (!fs.existsSync(envLocalPath) && !fs.existsSync(envPathRoot)) {
    console.log(`  2. Configura ${colors.yellow}.env${colors.reset} o ${colors.yellow}.env.local${colors.reset}`);
  }
  console.log(`  3. ${colors.yellow}npm run verify${colors.reset}`);
  console.log(`  4. ${colors.yellow}npm run dev${colors.reset}`);
}
console.log(`${'='.repeat(60)}\n`);
