# PROJECT CONTEXT — HBI Agente de Financiación

## Origen
Adaptación de **Gestion_Archivos_comware** al documento *FLUJO DE PROCESOS (WORKFLOW) — Agente de Financiación* (HBI, Mayo 2026).

## Matriz de cumplimiento del documento

| Requerimiento PDF | Implementación |
|-------------------|----------------|
| 3 servicios: Agente Administrativo, Garantías, Cálculo (Anexos 1–3) | `tipo_servicio_hbi`, selección en alta, segregación Fase 4 |
| Fase 1: cargar y clasificar base contractual | `Fase1DocumentosPanel` + `POST .../documentos` + Azure Blob |
| Identificación Anexo 1, 2 y 3 | `clasificarDocumentoPorNombre()` + override manual |
| Extracción información clave | `extraerDatosClaveDocumento()` en `datos_extraidos` |
| Paquete de contratos por crédito | `operaciones_credito` + `documentos_contractuales` por `operacion_id` |
| Fase 2: canal de comunicaciones | `Fase2CorreosPanel` + registro manual (Graph: roadmap) |
| Buzón único por operación (Agente–HBI, Deudor, Acreedores) | `correos_operacion` + `detectarOrigenCorreo()` |
| Data útil: remitente, tema, prioridad | Campos + detección automática de prioridad |
| Expediente maestro desde el primer momento | `expediente_maestro` al crear operación + `MotorOperativoService.sincronizarOperacion()` |
| Vista 360: contractual, cronogramas, comunicaciones, responsables, alertas | `Vista360Panel` + JSON en expediente |
| Trazabilidad actual e histórica por crédito y por anexo | `historial_operacion` + actividades por `tipo_servicio` |
| Fase 4: motor operativo recurrente por 3 servicios | Plantillas al entrar Fase 4 + `Fase4ActividadesPanel` |
| Reglas estrictas: estado, avance, próximos pasos | `validarAvanceFase()` + `EstadoIntegralBanner` + bloqueo avance si falta requisito |

## Modo actual: demo funcional (sin BD)
Sin variables de entorno: el demo viene activo por defecto en código (datos quemados, sin PostgreSQL).

### Autenticación demo
- `lib/auth/demo-users.ts` — 6 usuarios de prueba (Anexos 1–3, director, deudor y acreedor)
- Login: sección **Usuarios de prueba** en `/login` (un clic) o credenciales `*@hbi-demo.com` / `Demo2026!`
- Sin PostgreSQL: `authorize` en `auth.config.ts` solo valida usuarios demo
- `NEXTAUTH_SECRET` y `NEXTAUTH_URL` tienen fallback interno (incl. `VERCEL_URL` en producción)

### Datos HBI
- `lib/hbi/mock-store.ts` + persistencia `lib/hbi/mock-persistence.ts` (localStorage / caché del navegador)
- 7 operaciones de ejemplo (incluye operación premium `CRED-2026-00007` con desembolsos por hitos y checklist documental por hito); mutaciones conservadas entre recargas
- `MockSessionBridge` enlaza sesión → actor en trazabilidad
- Documentos subidos reciben huella demo (`hashContenido`) visible en Fase 1 y pestaña Trazabilidad
- Paleta visual alineada a branding HBI (`--color-hbi-*`) y wordmark HBI en header/login
- Seguridad de rutas movida a `proxy.ts` (Next.js 16) en lugar de `middleware.ts`
- Se fuerza tema claro en demo para evitar casos de bajo contraste (texto claro sobre fondos claros) en componentes heredados

Para producción con BD real: conectar PostgreSQL/Azure y adaptar servicios (fuera del alcance del demo actual).

## Stack
- Next.js 16 + React 19 + TypeScript + PostgreSQL (opcional) + Azure Blob + NextAuth + React Query + Zod

## API HBI
| Método | Ruta |
|--------|------|
| GET/POST | `/api/hbi/operaciones` |
| GET | `/api/hbi/operaciones/:id?vista360=true` |
| PATCH | `/api/hbi/operaciones/:id/fase` (validación de requisitos) |
| GET/POST | `/api/hbi/operaciones/:id/documentos` |
| GET/POST | `/api/hbi/operaciones/:id/correos` |
| PATCH | `/api/hbi/operaciones/:id/correos/:correoId` (marcar leído) |
| GET/POST | `/api/hbi/operaciones/:id/actividades` |
| PATCH | `/api/hbi/operaciones/:id/actividades/:actividadId` |
| GET/POST | `/api/hbi/operaciones/:id/estado-integral` |
| GET | `/api/hbi/operaciones/:id/trazabilidad` — línea de tiempo unificada |
| GET/POST | `/api/hbi/operaciones/:id/correos-enviados` — historial y envío |

## Trazabilidad (prioridad de negocio)
- **Línea de tiempo** (`TrazabilidadTimeline`): historial, documentos, correos recibidos/enviados, actividades, cambios de fase.
- **Correos enviados**: tabla `correos_enviados` vinculada con `operacion_id` + copia en `correos_operacion` (`direccion=ENVIADO`).
- Cada acción registra evento en `historial_operacion` (tipos: `CORREO_ENVIADO`, `CORREO_REGISTRADO`, `DOCUMENTO_SUBIDO`, etc.).

Migración trazabilidad: `npm run db:migrate-hbi-trazabilidad`

## Servicios (`services/hbi/`)
- `operacion.service.ts` — CRUD, vista 360, avance de fase validado
- `documento.service.ts` — subida, clasificación, extracción, historial
- `correo.service.ts` — bandeja, origen/prioridad
- `actividad.service.ts` — motor por anexo
- `motor-operativo.service.ts` — sync expediente, estado integral, plantillas Fase 4

## UI principal
- `/` — Dashboard por fase
- `/operaciones`, `/operaciones/nueva`, `/operaciones/[id]` — workflow completo con tabs por fase

## Migración
```bash
npm run db:migrate-hbi
# Opcional reglas:
psql ... -f database/seed-hbi-reglas.sql
```

## Roadmap (mejoras futuras)
- [ ] Microsoft Graph: sincronización automática de correos a bandeja
- [ ] OCR/IA para extracción profunda de PDFs contractuales
- [ ] Asignación de responsables desde UI (selector de usuarios)
- [ ] Notificaciones in-app dedicadas `notificaciones_hbi`
- [ ] Ocultar rutas legado Comware en producción HBI

## Convenciones
- Comentarios en español; sin `any`; Conventional Commits en español.
