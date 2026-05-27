# HBI — Agente de Financiación (Workflow)

Aplicación de gestión y control para la línea de negocio **Agente de Financiación** en créditos sindicados (Helm Banca de Inversión).

Basado en la arquitectura de [Gestion_Archivos_comware](../Gestion_Archivos_comware), adaptado al flujo de 4 fases del documento *260514 - HBI Agente de Financiación (Workflow).pdf*.

## Fases del proceso

1. **Ingreso de contratos** — Base contractual, Anexos 1–3, paquete por crédito  
2. **Registro de correos** — Buzón por operación (Agente–HBI, Deudor, Acreedores)  
3. **Expediente maestro** — Vista 360 (contractual, cronogramas, comunicaciones, alertas)  
4. **Seguimiento de actividades** — Motor operativo por Anexo 1, 2 y 3  

## Requisitos

- Node.js 18+
- PostgreSQL
- Azure Storage (documentos)
- Variables de entorno (ver `.env.example`)

## Instalación

```bash
cd "E:\clearMinds\CONWARE\HBI Inversion\proyecto"
npm install
cp .env.example .env.local
# Editar .env.local con credenciales
```

Base de datos (entorno nuevo):

```bash
# Esquema y auth del proyecto base
psql ... -f database/schema.sql
psql ... -f database/migration-auth.sql
npm run db:seed

# Esquema HBI Agente de Financiación
npm run db:migrate-hbi
```

Desarrollo:

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000) → **Operaciones HBI**.

## Estructura relevante

```
proyecto/
├── app/(dashboard)/operaciones/   # UI workflow HBI
├── app/api/hbi/operaciones/       # API REST
├── components/hbi/              # Stepper, Vista 360, listados
├── database/schema-hbi-agente-financiacion.sql
├── services/hbi/operacion.service.ts
├── types/hbi/operacion.types.ts
└── PROJECT_CONTEXT.md             # Fuente de verdad del dominio
```

## Licencia

Estrictamente privado y confidencial — HBI / Comware.
