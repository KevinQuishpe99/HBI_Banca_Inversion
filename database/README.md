# Base de datos (PostgreSQL)

## Vercel

El build en **Vercel no ejecuta SQL**. Configura variables de entorno y aplica migraciones contra tu Postgres **a mano** o con CI.

## Contenido útil

| Archivo / patrón | Uso |
|------------------|-----|
| `schema.sql` | Referencia de esquema |
| `migration-*.sql` | Cambios incrementales (ejecutar lo que falte en cada entorno) |
| `migration-notifications.sql` | Tabla y funciones de notificaciones |
| `migration-case-status-labels-pendiente.sql` | Etiquetas Pendiente / Devuelto / Trámite completado en `case_status_config` |
| `migration-case-status-revisado-inactive.sql` | Oculta `REVISADO` en la app (`is_active = false`; ya incluido al final de `migration-status-config.sql` en instalaciones nuevas) |

## Scripts npm (`package.json`)

- `db:migrate` — `migration-auth.sql`
- `db:migrate-review-presence`, `db:migrate-status-config`, `db:migrate-case-fields`
- `db:update-function`, `db:refresh-view`
- `db:seed`
- `db:migrate-drop-workflow-engine` — quita enrutado legacy y tablas `workflow_*`; añade `approved_review_areas` y actualiza `get_cases_for_user`.
- `db:migrate-routing-flows` — tabla `routing_creator_area` y columnas `cases.creator_area`, `routing_flow`, `supervision_area`, `supervision_completed`; amplía `get_cases_for_user` con esas columnas.
- `db:clear-tramites` — borra **todos** los trámites (`cases`), archivos (`files`) y tablas dependientes; **no** borra usuarios ni catálogos. Opcional: `npm run db:clear-tramites -- --azure` para eliminar blobs con prefijo `case-` en Azure (requiere `AZURE_*` en `.env.local`). **Solo usar en dev/staging** o cuando quieras un entorno limpio a propósito.

Requieren `.env.local` con `DB_*` (o equivalente).

## Conexiones y pool (`lib/db/index.ts`)

- **`DB_POOL_MAX`** (opcional, 1–20): cuántas conexiones TCP abre **cada proceso** Node hacia Postgres. Por defecto **2** (dev y prod) si no defines la variable; en `.env.example` va **`DB_POOL_MAX=2`**.
- En **Vercel** hay muchas instancias serverless: el uso total se aproxima a **instancias concurrentes × `DB_POOL_MAX`**. Si te acercas a `max_connections` del servidor, baja `DB_POOL_MAX` (p. ej. `2` o `1`) o usa un **pooler** delante.

### PgBouncer / pool de Azure PostgreSQL

No se instala en este repo: en **Azure Flexible Server** viene **PgBouncer integrado** (mismo servidor, otro puerto).

1. **Portal Azure** → tu servidor PostgreSQL (Flexible) → **Parámetros del servidor** → busca **`pgbouncer.enabled`** → `ON` / `true` → Guardar.
2. En la app usa el **mismo `DB_HOST`**, puerto **`6432`** (pooler), no `5432` (motor directo): `DB_PORT=6432` y `DB_SSL=true` como ya tengas.
3. Pon **`DB_POOL_MAX`** bajo (1–2); el pooler multiplexa muchas peticiones.

Documentación: [Conceptos de PgBouncer (Microsoft Learn)](https://learn.microsoft.com/azure/postgresql/flexible-server/concepts-pgbouncer).

Consulta en el servidor: `SHOW max_connections;` y `SELECT count(*) FROM pg_stat_activity;`.

## Limpieza aplicada

Enrutado Comercial/Legal y migraciones `migration-workflow-routing*` quedaron **fusionados** en `migration-drop-workflow-engine.sql` (un solo comando npm). Otros scripts legacy duplicados se retiraron del repo; el historial sigue en Git si hiciera falta.
