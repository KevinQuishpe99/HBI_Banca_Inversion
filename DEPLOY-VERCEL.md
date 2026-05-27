# Despliegue demo en Vercel — HBI Agente de Financiación

## Paso 1 — Tú creas el proyecto vacío en Vercel

1. Entra a [vercel.com/new](https://vercel.com/new) con el team **Comware**.
2. Crea un proyecto **sin conectar Git** (vacío / Skip).
3. Nombre sugerido: **`hbi-agente-financiacion`**
4. Framework: **Next.js** (o Other; se detecta solo al desplegar).
5. **No agregues variables de entorno** (el demo funciona sin ellas).

Cuando lo tengas, dime el **nombre exacto** del proyecto y yo completo el enlace local (`.vercel/project.json`) con el MCP.

---

## Paso 2 — Configuración ya lista en el código

| Archivo | Qué hace |
|---------|----------|
| `vercel.json` | Next.js, build, env demo (`NEXT_PUBLIC_HBI_MOCK_DATA=true`) |
| `lib/auth/auth.config.ts` | Usa `VERCEL_URL` automáticamente para login en producción |
| Sin PostgreSQL / Azure | Todo mock en memoria + localStorage |

**Settings en dashboard** (si te los pide al crear):

- Root Directory: `.` (despliegas desde la carpeta `proyecto`)
- Build Command: `npm run build`
- Install Command: `npm install`
- Output: automático (Next.js)

---

## Paso 3 — Desplegar (después del enlace)

```powershell
cd "e:\clearMinds\CONWARE\HBI Inversion\proyecto"
vercel login
vercel --prod
```

O, si ya existe `.vercel/project.json` generado por el asistente:

```powershell
$env:VERCEL_ORG_ID="team_WMU6B3HaEChbbflNqeZehDrW"
$env:VERCEL_PROJECT_ID="prj_xxx"   # el que corresponda
vercel --prod
```

---

## Variables de entorno (opcional)

Para el demo **no necesitas configurar ninguna variable** en Vercel.

Opcional en dashboard → Settings → Environment Variables:

| Variable | Valor | Notas |
|----------|-------|-------|
| `NEXT_PUBLIC_HBI_MOCK_DATA` | `true` | Ya en `vercel.json` |
| `NEXT_PUBLIC_MICROSOFT_LOGIN_ENABLED` | `false` | Ya en `vercel.json` |

No hace falta PostgreSQL, Azure ni secretos para la versión demo.

---

## Usuarios de prueba

En `/login`, sección **Usuarios de prueba** (un clic). Contraseña manual: `Demo2026!`

- `maria.gonzalez@hbi-demo.com` — Anexo 1 (administrativo)
- `carlos.ruiz@hbi-demo.com` — Anexo 2 (garantías)
- `ana.torres@hbi-demo.com` — Anexo 3 (cálculo)
- `director@hbi-demo.com` — Administrador demo
- `deudor@hbi-demo.com` — Perfil cliente deudor
- `acreedor@hbi-demo.com` — Perfil acreedor sindicado

---

## Datos del demo

Se persisten en **localStorage** del navegador. Botón **Restaurar demo** en el banner amarillo del inicio.

---

## Team Vercel (referencia)

- Team: **Comware** (`comware-projects-028f7882`)
- Org ID: `team_WMU6B3HaEChbbflNqeZehDrW`

**No uses** el proyecto `automitizacion-hbi-capital` — es otro producto (Python/backend).
