import { query } from '@/lib/db';

export type FileCommentRow = {
  id: string;
  caseId: string;
  fileId: string;
  userId: string;
  userArea: number | null;
  content: string;
  createdAt: Date;
  authorName: string;
};

export class FileCommentService {
  static async listByCase(caseId: string): Promise<FileCommentRow[]> {
    const result = await query<{
      id: string;
      tramite_id: string;
      archivo_id: string;
      usuario_id: string;
      area_usuario_id: number | null;
      contenido: string;
      creado_en: Date;
      author_name: string;
    }>(
      `SELECT ca.id, ca.tramite_id, ca.archivo_id, ca.usuario_id, ca.area_usuario_id,
              ca.contenido, ca.creado_en,
              TRIM(COALESCE(u.nombre, '') || ' ' || COALESCE(u.apellido, '')) AS author_name
       FROM comentarios_archivo ca
       JOIN usuarios u ON u.id = ca.usuario_id
       WHERE ca.tramite_id = $1
       ORDER BY ca.creado_en ASC`,
      [caseId]
    );

    return result.rows.map((r) => ({
      id: r.id,
      caseId: r.tramite_id,
      fileId: r.archivo_id,
      userId: r.usuario_id,
      userArea: r.area_usuario_id,
      content: r.contenido,
      createdAt: r.creado_en,
      authorName: r.author_name.trim() || 'Usuario',
    }));
  }

  static async create(
    fileId: string,
    caseId: string,
    userId: string,
    userAreaId: number | undefined,
    content: string
  ): Promise<void> {
    await query(
      `INSERT INTO comentarios_archivo (tramite_id, archivo_id, usuario_id, area_usuario_id, contenido)
       VALUES ($1, $2, $3, $4, $5)`,
      [caseId, fileId, userId, userAreaId ?? null, content.trim()]
    );
  }
}
