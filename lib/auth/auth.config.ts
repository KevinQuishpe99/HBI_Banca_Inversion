import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import AzureADProvider from 'next-auth/providers/azure-ad';
import { compare } from 'bcryptjs';
import { isLikelyDbConnectivityError, query } from '@/lib/db';
import { isUserSupervisorForArea } from '@/lib/auth/area-supervisor';
import { UserRole } from '@/types/user.types';
import { query as dbQuery } from '@/lib/db';
import { hasSupervisorPuedeCrearTramiteColumn } from '@/lib/db/configuracion-areas-columns';

function isPgUndefinedColumnError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '42703'
  );
}

async function getSessionAreaPermissions(
  userId: string | undefined,
  areaId: number | undefined | null
): Promise<{
  isSigningArea: boolean;
  isFinalStepArea: boolean;
  supervisorCanCreateCase: boolean;
  puedeCompletarTramite: boolean;
}> {
  if (!areaId || !userId) {
    return {
      isSigningArea: false,
      isFinalStepArea: false,
      supervisorCanCreateCase: true,
      puedeCompletarTramite: false,
    };
  }
  try {
    const hasCol = await hasSupervisorPuedeCrearTramiteColumn();
    const selectSup = (useRealColumn: boolean) =>
      useRealColumn ? 'supervisor_puede_crear_tramite' : 'TRUE AS supervisor_puede_crear_tramite';

    type Row = {
      permite_firma: boolean;
      es_paso_final: boolean;
      puede_completar_tramite: boolean;
      supervisor_id: string | null;
      supervisor_puede_crear_tramite: boolean;
    };

    let r: { rows: Row[] };
    try {
      r = await dbQuery<Row>(
        `SELECT permite_firma, es_paso_final, puede_completar_tramite, supervisor_id, ${selectSup(hasCol)}
         FROM configuracion_areas WHERE id = $1 AND activo = true`,
        [areaId]
      );
    } catch (e) {
      if (hasCol && isPgUndefinedColumnError(e)) {
        r = await dbQuery<Row>(
          `SELECT permite_firma, es_paso_final, puede_completar_tramite, supervisor_id, ${selectSup(false)}
           FROM configuracion_areas WHERE id = $1 AND activo = true`,
          [areaId]
        );
      } else {
        throw e;
      }
    }
    const row = r.rows[0];
    if (!row) {
      return {
        isSigningArea: false,
        isFinalStepArea: false,
        supervisorCanCreateCase: true,
        puedeCompletarTramite: false,
      };
    }
    let supervisorCanCreateCase = true;
    if (row.supervisor_id != null && row.supervisor_id === userId) {
      supervisorCanCreateCase = row.supervisor_puede_crear_tramite === true;
    }
    return {
      isSigningArea: row.permite_firma === true,
      isFinalStepArea: row.es_paso_final === true,
      supervisorCanCreateCase,
      puedeCompletarTramite: row.puede_completar_tramite === true,
    };
  } catch {
    return {
      isSigningArea: false,
      isFinalStepArea: false,
      supervisorCanCreateCase: true,
      puedeCompletarTramite: false,
    };
  }
}

import {
  emailFromMicrosoftProfile,
  getDbUserForMicrosoftEmail,
  isMicrosoftLoginDomainAllowed,
  isMicrosoftOAuthConfigured,
} from '@/lib/auth/microsoft-auth';
import { demoUserToSession, findDemoUser, isDemoAuthEnabled } from '@/lib/auth/demo-users';
import { resolveAuthSecret } from '@/lib/auth/auth-env';

const LEGACY_AREA_ROLES = ['COMERCIAL', 'TECNICA', 'FINANCIERA', 'LEGAL', 'DIRECTOR_GENERAL'] as const;

function normalizeRole(input: { role?: unknown }): { role?: UserRole } {
  const rawRole = typeof input.role === 'string' ? input.role : undefined;
  if (!rawRole) return {};
  if (rawRole === 'USER' || rawRole === 'ADMIN' || rawRole === 'AREA_USER') {
    return { role: rawRole as UserRole };
  }
  if ((LEGACY_AREA_ROLES as readonly string[]).includes(rawRole)) {
    return { role: 'AREA_USER' };
  }
  return { role: rawRole as UserRole };
}

async function applyAreaUserJwtFlags(
  token: Record<string, unknown>,
  userId: string | undefined,
  areaId: number | undefined
): Promise<void> {
  const r = (token.role as string | undefined) ?? '';
  if (r === 'AREA_USER' && userId && areaId != null) {
    token.isAreaSupervisor = await isUserSupervisorForArea(userId, areaId);
    const flags = await getSessionAreaPermissions(userId, areaId);
    token.isSigningArea = flags.isSigningArea;
    token.isFinalStepArea = flags.isFinalStepArea;
    token.supervisorCanCreateCase = flags.supervisorCanCreateCase;
    token.puedeCompletarTramite = flags.puedeCompletarTramite;
  } else {
    token.isAreaSupervisor = false;
    token.isSigningArea = false;
    token.isFinalStepArea = false;
    token.supervisorCanCreateCase = true;
    token.puedeCompletarTramite = false;
  }
}

const microsoftProvider = isMicrosoftOAuthConfigured()
  ? AzureADProvider({
      clientId: process.env.AZURE_AUTH_CLIENT_ID!,
      clientSecret: process.env.AZURE_AUTH_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AUTH_TENANT_ID!,
      authorization: {
        params: {
          prompt: 'select_account',
          scope: 'openid profile email User.Read',
        },
      },
    })
  : null;

export const authOptions: NextAuthOptions = {
  providers: [
    ...(microsoftProvider ? [microsoftProvider] : []),
    CredentialsProvider({
      name: 'Credenciales',
      credentials: {
        email: { label: 'Correo electrónico', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Error al iniciar sesión');
        }

        const emailNorm = credentials.email.trim().toLowerCase();

        if (isDemoAuthEnabled()) {
          const demo = findDemoUser(credentials.email, credentials.password);
          if (demo) {
            const session = demoUserToSession(demo);
            return {
              id: session.id,
              email: session.email,
              name: session.name,
              canSign: session.canSign,
              areaName: session.areaName,
              role: session.role,
            };
          }
          throw new Error('Credenciales inválidas');
        }

        let result;
        try {
          result = await query<{
            id: string;
            email: string;
            hash_contrasena: string;
            nombre: string;
            apellido: string;
            rol: string;
            area_id: number | null;
            area_name: string | null;
            activo: boolean;
            puede_firmar: boolean;
          }>(
            `SELECT u.id, u.email, u.hash_contrasena, u.nombre, u.apellido,
                    u.rol, u.area_id, ca.nombre_area AS area_name, u.activo, u.puede_firmar
             FROM usuarios u
             LEFT JOIN configuracion_areas ca ON ca.id = u.area_id
             WHERE lower(trim(u.email)) = $1`,
            [emailNorm]
          );
        } catch (e) {
          console.error('[auth] login', isLikelyDbConnectivityError(e) ? 'db' : 'query', e);
          throw new Error('Error al iniciar sesión');
        }

        const user = result.rows[0];

        if (!user) {
          throw new Error('Credenciales inválidas');
        }

        if (!user.activo) {
          throw new Error('Error al iniciar sesión');
        }

        if (!user.hash_contrasena || typeof user.hash_contrasena !== 'string') {
          throw new Error('Error al iniciar sesión');
        }

        const isValidPassword = await compare(credentials.password, user.hash_contrasena);

        if (!isValidPassword) {
          throw new Error('Credenciales inválidas');
        }

        try {
          await Promise.all([
            query(`UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id = $1`, [user.id]),
            query(
              `INSERT INTO registro_auditoria (usuario_id, accion, tipo_entidad, entidad_id, comentario)
               VALUES ($1, 'CREATED', 'session', $1, 'Usuario inició sesión')`,
              [user.id]
            ),
          ]);
        } catch (e) {
          console.error('[auth] post-login', e);
        }

        const nr = normalizeRole({ role: user.rol });
        return {
          id: user.id,
          email: user.email,
          name: `${user.nombre} ${user.apellido}`,
          canSign: !!user.puede_firmar,
          areaId: user.area_id ?? undefined,
          areaName: user.area_name ?? undefined,
          role: nr.role ?? (user.rol as UserRole),
        };
      },
    }),
  ],

  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== 'azure-ad') return true;
      const email = emailFromMicrosoftProfile(profile as Record<string, unknown>);
      if (!email || !isMicrosoftLoginDomainAllowed(email)) return false;
      const dbUser = await getDbUserForMicrosoftEmail(email);
      if (!dbUser?.is_active) return false;
      return true;
    },

    async jwt({ token, user, account, profile }) {
      if (account?.provider === 'azure-ad' && profile) {
        const email = emailFromMicrosoftProfile(profile as Record<string, unknown>);
        if (email) {
          const dbUser = await getDbUserForMicrosoftEmail(email);
          if (dbUser && dbUser.is_active) {
            const normalized = normalizeRole({ role: dbUser.role });
            token.id = dbUser.id;
            token.email = dbUser.email;
            token.name = `${dbUser.first_name} ${dbUser.last_name}`;
            token.role = normalized.role ?? (dbUser.role as UserRole);
            token.areaName = dbUser.area_name ?? undefined;
            token.areaId = dbUser.area_id ?? undefined;
            token.canSign = !!dbUser.can_sign;

            await applyAreaUserJwtFlags(
              token as Record<string, unknown>,
              dbUser.id,
              dbUser.area_id ?? undefined
            );

            await Promise.all([
              query(`UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id = $1`, [dbUser.id]),
              query(
                `INSERT INTO registro_auditoria (usuario_id, accion, tipo_entidad, entidad_id, comentario)
                 VALUES ($1, 'CREATED', 'session', $1, 'Usuario inició sesión con Microsoft')`,
                [dbUser.id]
              ),
            ]);
          }
        }
        const t = token as Record<string, unknown>;
        const rid = t.id as string | undefined;
        const role = (t.role as string | undefined) ?? '';
        const aid = t.areaId as number | undefined;
        await applyAreaUserJwtFlags(t, rid, role === 'AREA_USER' ? aid : undefined);
        return token;
      }

      if (user && account?.provider !== 'azure-ad') {
        const u = user as {
          id: string;
          role: UserRole;
          areaId?: number;
          areaName?: string;
          email: string;
          canSign?: boolean;
        };
        token.id = u.id;
        token.role = u.role;
        token.areaName = u.areaName;
        token.areaId = u.areaId;
        token.email = u.email;
        token.canSign = !!u.canSign;
        await applyAreaUserJwtFlags(token as Record<string, unknown>, u.id, u.areaId);
      }

      const t = token as Record<string, unknown>;
      const rid = t.id as string | undefined;
      const role = (t.role as string | undefined) ?? '';
      const aid = t.areaId as number | undefined;
      await applyAreaUserJwtFlags(t, rid, role === 'AREA_USER' ? aid : undefined);

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as UserRole) ?? 'USER';
        session.user.areaName = (token as { areaName?: string }).areaName;
        session.user.areaId = (token as { areaId?: number }).areaId;
        session.user.email = token.email as string;
        session.user.canSign = !!(token as { canSign?: boolean }).canSign;
        session.user.isAreaSupervisor = !!(token as { isAreaSupervisor?: boolean }).isAreaSupervisor;
        session.user.isSigningArea = !!(token as { isSigningArea?: boolean }).isSigningArea;
        session.user.isFinalStepArea = !!(token as { isFinalStepArea?: boolean }).isFinalStepArea;
        session.user.supervisorCanCreateCase = (token as { supervisorCanCreateCase?: boolean }).supervisorCanCreateCase !== false;
        session.user.puedeCompletarTramite = !!(token as { puedeCompletarTramite?: boolean }).puedeCompletarTramite;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) {
        return url;
      }
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      return baseUrl;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60,
  },

  jwt: {
    maxAge: 8 * 60 * 60,
  },

  secret: resolveAuthSecret(),

  debug: process.env.NEXTAUTH_DEBUG === 'true',
};
