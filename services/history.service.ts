import { query } from '@/lib/db';
import { AuditLogWithUser, CommentWithUser } from '@/types/history.types';

export class HistoryService {
  /**
   * Obtiene el historial completo de un trámite
   */
  static async getCaseHistory(caseId: string): Promise<AuditLogWithUser[]> {
    const result = await query<Record<string, unknown>>(
      `SELECT
        ra.*,
        u.nombre || ' ' || u.apellido as user_name,
        u.email as user_email,
        u.area_id as user_area_id
       FROM registro_auditoria ra
       LEFT JOIN usuarios u ON ra.usuario_id = u.id
       WHERE ra.tramite_id = $1
       ORDER BY ra.creado_en ASC`,
      [caseId]
    );

    return result.rows.map((row) => this.mapAuditFromDb(row));
  }

  /**
   * Obtiene los comentarios de un trámite
   */
  static async getCaseComments(caseId: string): Promise<CommentWithUser[]> {
    const result = await query<Record<string, unknown>>(
      `SELECT
        c.*,
        u.nombre || ' ' || u.apellido as user_name,
        u.rol as user_role,
        u.area_id as user_area_id
       FROM comentarios c
       JOIN usuarios u ON c.usuario_id = u.id
       WHERE c.tramite_id = $1
       ORDER BY c.creado_en ASC`,
      [caseId]
    );

    return result.rows.map((row) => this.mapCommentFromDb(row));
  }

  /**
   * Agrega un comentario
   */
  static async addComment(
    caseId: string,
    userId: string,
    content: string,
    isInternal: boolean = false
  ): Promise<CommentWithUser> {
    const result = await query<Record<string, unknown>>(
      `INSERT INTO comentarios (tramite_id, usuario_id, contenido, es_interno)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [caseId, userId, content, isInternal]
    );

    await query(
      `INSERT INTO registro_auditoria (tramite_id, usuario_id, accion, tipo_entidad, entidad_id)
       VALUES ($1, $2, 'COMMENT_ADDED', 'comment', $3)`,
      [caseId, userId, result.rows[0].id]
    );

    return this.mapCommentFromDb(result.rows[0]);
  }

  private static mapAuditFromDb(row: Record<string, unknown>): AuditLogWithUser {
    return {
      id: row.id as string,
      tramiteId: row.tramite_id as string | undefined,
      usuarioId: row.usuario_id as string | undefined,
      action: row.accion as AuditLogWithUser['action'],
      entityType: row.tipo_entidad as string | undefined,
      entityId: row.entidad_id as string | undefined,
      oldValue: row.valor_anterior as Record<string, unknown> | undefined,
      newValue: row.valor_nuevo as Record<string, unknown> | undefined,
      comments: row.comentario as string | undefined,
      createdAt: row.creado_en as Date,
      userName: row.user_name as string | undefined,
      userEmail: row.user_email as string | undefined,
      userArea: (row.user_area_id as string | null | undefined) ?? null,
    };
  }

  private static mapCommentFromDb(row: Record<string, unknown>): CommentWithUser {
    return {
      id: row.id as string,
      tramiteId: row.tramite_id as string,
      usuarioId: row.usuario_id as string,
      content: row.contenido as string,
      isInternal: row.es_interno as boolean,
      createdAt: row.creado_en as Date,
      updatedAt: row.actualizado_en as Date,
      userName: String(row.user_name ?? ''),
      userRole: String(row.user_role ?? ''),
      userArea: (row.user_area_id as string | null | undefined) ?? null,
    };
  }
}
