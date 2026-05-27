import { transaction } from '@/lib/db';
import type { PoolClient } from 'pg';

/**
 * Sentencias en orden seguro de FKs (mismo criterio que database/clear-tramites-y-archivos.sql).
 */
const WIPE_STATEMENTS: string[] = [
  'DELETE FROM bloqueo_anotacion',
  'DELETE FROM comentarios_archivo',
  'DELETE FROM archivos_por_firmar',
  'DELETE FROM alertas_plazo_tramite',
  'DELETE FROM presencia_revision',
  'DELETE FROM tramite_areas_revision',
  'DELETE FROM tramite_areas_aprobadas',
  'UPDATE archivos SET archivo_fuente_firmado_id = NULL WHERE archivo_fuente_firmado_id IS NOT NULL',
  'UPDATE archivos SET archivo_padre_id = NULL WHERE archivo_padre_id IS NOT NULL',
  'DELETE FROM archivos',
  'DELETE FROM comentarios',
  'DELETE FROM registro_auditoria WHERE tramite_id IS NOT NULL',
  'DELETE FROM notificaciones WHERE tramite_id IS NOT NULL',
  'DELETE FROM tramites',
];

async function execOrSkipMissingTable(client: PoolClient, sql: string, params?: unknown[]): Promise<void> {
  try {
    if (params !== undefined) await client.query(sql, params);
    else await client.query(sql);
  } catch (e: unknown) {
    const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: string }).code) : '';
    if (code === '42P01') return;
    throw e;
  }
}

export class DevWipeService {
  static async wipeTramitesYArchivos(): Promise<void> {
    await transaction(async (client) => {
      for (const sql of WIPE_STATEMENTS) {
        await execOrSkipMissingTable(client, sql);
      }
    });
  }

  /**
   * Elimina un trámite y sus datos ligados (mismo criterio que el borrado masivo, pero por ID).
   */
  static async wipeSingleTramite(tramiteId: string): Promise<void> {
    const p = [tramiteId];
    await transaction(async (client) => {
      await execOrSkipMissingTable(
        client,
        `DELETE FROM bloqueo_anotacion WHERE archivo_id IN (SELECT id FROM archivos WHERE tramite_id = $1::uuid)`,
        p
      );
      await execOrSkipMissingTable(client, `DELETE FROM comentarios_archivo WHERE tramite_id = $1::uuid`, p);
      await execOrSkipMissingTable(client, `DELETE FROM archivos_por_firmar WHERE tramite_id = $1::uuid`, p);
      await execOrSkipMissingTable(client, `DELETE FROM alertas_plazo_tramite WHERE tramite_id = $1::uuid`, p);
      await execOrSkipMissingTable(client, `DELETE FROM presencia_revision WHERE tramite_id = $1::uuid`, p);
      await execOrSkipMissingTable(client, `DELETE FROM tramite_areas_revision WHERE tramite_id = $1::uuid`, p);
      await execOrSkipMissingTable(client, `DELETE FROM tramite_areas_aprobadas WHERE tramite_id = $1::uuid`, p);
      await execOrSkipMissingTable(
        client,
        `UPDATE archivos SET archivo_fuente_firmado_id = NULL WHERE archivo_fuente_firmado_id IN (SELECT id FROM archivos WHERE tramite_id = $1::uuid)`,
        p
      );
      await execOrSkipMissingTable(
        client,
        `UPDATE archivos SET archivo_padre_id = NULL WHERE archivo_padre_id IN (SELECT id FROM archivos WHERE tramite_id = $1::uuid)`,
        p
      );
      await execOrSkipMissingTable(client, `DELETE FROM archivos WHERE tramite_id = $1::uuid`, p);
      await execOrSkipMissingTable(client, `DELETE FROM comentarios WHERE tramite_id = $1::uuid`, p);
      await execOrSkipMissingTable(client, `DELETE FROM registro_auditoria WHERE tramite_id = $1::uuid`, p);
      await execOrSkipMissingTable(client, `DELETE FROM notificaciones WHERE tramite_id = $1::uuid`, p);
      await execOrSkipMissingTable(client, `DELETE FROM tramites WHERE id = $1::uuid`, p);
    });
  }
}
