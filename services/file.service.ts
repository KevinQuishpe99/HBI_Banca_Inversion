import { query, transaction } from '@/lib/db';
import { getBlobStorage } from '@/lib/azure/blob-storage';
import { dbEstadoTramiteToApp } from '@/lib/db/estado-tramite-map';
import { FileRecord, UploadFileData } from '@/types/file.types';
import { ForbiddenError, ValidationError, AppError } from '@/lib/utils/errors';
import { truncateFileName, isAllowedSignedDocumentFileName } from '@/lib/validations/file.schema';
import { PoolClient } from 'pg';

export class FileService {
  /**
   * Obtiene todos los archivos de un trámite
   */
  static async getCaseFiles(caseId: string): Promise<FileRecord[]> {
    const result = await query<Record<string, unknown>>(
      `SELECT
        a.*,
        u.nombre || ' ' || u.apellido as uploaded_by_name
       FROM archivos a
       JOIN usuarios u ON a.subido_por = u.id
       WHERE a.tramite_id = $1 AND a.eliminado = false
       ORDER BY a.version DESC, a.subido_en DESC`,
      [caseId]
    );

    return result.rows.map((row) => this.mapFileFromDb(row as unknown as Record<string, unknown>));
  }

  /**
   * Obtiene un archivo por ID
   */
  static async getFileById(id: string): Promise<FileRecord | null> {
    const result = await query<FileRecord>(
      'SELECT * FROM archivos WHERE id = $1 AND eliminado = false',
      [id]
    );

    if (result.rows.length === 0) return null;
    return this.mapFileFromDb(result.rows[0] as unknown as Record<string, unknown>);
  }

  /**
   * Sube un archivo
   */
  static async uploadFile(
    data: UploadFileData,
    userId: string,
    fileBuffer: Buffer
  ): Promise<FileRecord> {
    return transaction(async (client: PoolClient) => {
      let version = 1;
      if (data.parentFileId) {
        const parentResult = await client.query(
          'SELECT version FROM archivos WHERE id = $1',
          [data.parentFileId]
        );
        if (parentResult.rows.length > 0) {
          version = parentResult.rows[0].version + 1;
        }
      }

      const storedFileName = truncateFileName(data.fileName);

      const blobStorage = getBlobStorage();
      const { blobUrl, blobPath } = await blobStorage.uploadFile(
        data.caseId,
        storedFileName,
        fileBuffer,
        version,
        false
      );

      const isCreationUpload = data.isCreationUpload === true;

      const result = await client.query<FileRecord>(
        `INSERT INTO archivos (
          tramite_id, nombre_archivo, tipo_archivo, tamano_archivo, tipo_mime,
          descripcion, motivo_firma, url_blob, ruta_blob,
          version, archivo_padre_id, subido_por, es_carga_inicial
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          data.caseId,
          storedFileName,
          data.fileType,
          fileBuffer.length,
          this.getMimeType(data.fileName),
          data.description,
          data.signatureReason,
          blobUrl,
          blobPath,
          version,
          data.parentFileId,
          userId,
          isCreationUpload,
        ]
      );

      await client.query(
        `INSERT INTO registro_auditoria (tramite_id, usuario_id, accion, tipo_entidad, entidad_id, valor_nuevo)
         VALUES ($1, $2, 'FILE_UPLOADED', 'file', $3, $4)`,
        [
          data.caseId,
          userId,
          result.rows[0].id,
          JSON.stringify({ fileName: data.fileName, version }),
        ]
      );

      return this.mapFileFromDb(result.rows[0] as unknown as Record<string, unknown>);
    });
  }

  /**
   * Sube un archivo final firmado
   */
  static async uploadFinalFile(
    caseId: string,
    fileName: string,
    fileBuffer: Buffer,
    userId: string,
    signedSourceFileId?: string
  ): Promise<FileRecord> {
    return transaction(async (client: PoolClient) => {
      const safeName = truncateFileName(fileName);
      if (!isAllowedSignedDocumentFileName(safeName)) {
        throw new ValidationError(
          'Solo se aceptan documentos firmados en PDF o Word (.doc, .docx).'
        );
      }
      const fileType = this.inferFileTypeFromName(safeName);
      const mimeType = this.getMimeType(safeName);
      const blobStorage = getBlobStorage();
      const { blobUrl, blobPath } = await blobStorage.uploadFile(
        caseId,
        safeName,
        fileBuffer,
        1,
        true
      );

      const result = await client.query<FileRecord>(
        `INSERT INTO archivos (
          tramite_id, nombre_archivo, tipo_archivo, tamano_archivo, tipo_mime,
          url_blob, ruta_blob, version, es_final, firmado, archivo_fuente_firmado_id, subido_por
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, true, true, $8, $9)
        RETURNING *`,
        [
          caseId,
          safeName,
          fileType,
          fileBuffer.length,
          mimeType,
          blobUrl,
          blobPath,
          signedSourceFileId ?? null,
          userId,
        ]
      );

      return this.mapFileFromDb(result.rows[0] as unknown as Record<string, unknown>);
    });
  }

  /**
   * Sustituye el contenido del archivo en almacenamiento manteniendo el mismo id.
   * Solo el creador con trámite devuelto y «habilitar actualización de archivos».
   */
  static async replaceFileContent(
    fileId: string,
    userId: string,
    fileBuffer: Buffer,
    fileName: string
  ): Promise<FileRecord> {
    return transaction(async (client: PoolClient) => {
      const meta = await client.query<{
        id: string;
        tramite_id: string;
        ruta_blob: string | null;
        version: number;
        es_final: boolean;
        firmado: boolean;
        eliminado: boolean;
        creado_por: string;
        estado: number;
        rafu: boolean;
      }>(
        `SELECT a.id, a.tramite_id, a.ruta_blob, a.version, a.es_final, a.firmado, a.eliminado,
                t.creado_por, t.estado_id AS estado,
                COALESCE(t.permite_actualizacion_devolucion, false) AS rafu
         FROM archivos a
         JOIN tramites t ON t.id = a.tramite_id
         WHERE a.id = $1`,
        [fileId]
      );
      if (meta.rows.length === 0) {
        throw new ValidationError('Archivo no encontrado');
      }
      const row = meta.rows[0];
      if (row.eliminado) {
        throw new ValidationError('El archivo ya no está disponible');
      }
      if (row.es_final || row.firmado) {
        throw new ValidationError('No se puede reemplazar un archivo firmado o final');
      }
      if (dbEstadoTramiteToApp(row.estado) !== 'RETURNED') {
        throw new ValidationError('Solo puede reemplazar archivos cuando el trámite está devuelto');
      }
      if (row.creado_por !== userId) {
        throw new ForbiddenError('Solo quien creó el trámite puede sustituir este archivo');
      }
      // En estado devuelto, el creador puede sustituir archivos para corregir y reenviar.

      const blobStorage = getBlobStorage();
      if (row.ruta_blob) {
        try {
          await blobStorage.deleteFile(row.ruta_blob);
        } catch {
          /* blob previo ya inexistente */
        }
      }

      const { blobUrl, blobPath } = await blobStorage.uploadFile(
        row.tramite_id,
        fileName,
        fileBuffer,
        row.version,
        false
      );

      const mimeType = this.getMimeType(fileName);
      const fileType = this.inferFileTypeFromName(fileName);

      await client.query(
        `UPDATE archivos
         SET nombre_archivo = $1,
             tamano_archivo = $2,
             tipo_mime = $3,
             tipo_archivo = $4::file_type,
             url_blob = $5,
             ruta_blob = $6,
             subido_por = $7
         WHERE id = $8`,
        [fileName, fileBuffer.length, mimeType, fileType, blobUrl, blobPath, userId, fileId]
      );

      await client.query(
        `INSERT INTO registro_auditoria (tramite_id, usuario_id, accion, tipo_entidad, entidad_id, valor_nuevo)
         VALUES ($1, $2, 'FILE_UPLOADED', 'file', $3, $4)`,
        [
          row.tramite_id,
          userId,
          fileId,
          JSON.stringify({ replaced: true, fileName, size: fileBuffer.length }),
        ]
      );

      const fresh = await client.query(
        `SELECT a.*, u.nombre || ' ' || u.apellido as uploaded_by_name
         FROM archivos a
         JOIN usuarios u ON a.subido_por = u.id
         WHERE a.id = $1`,
        [fileId]
      );
      return this.mapFileFromDb(fresh.rows[0] as unknown as Record<string, unknown>);
    });
  }

  /**
   * Sustituye el binario del archivo (PDF anotado o Word revisado; mismo id de registro).
   * Solo durante SUBMITTED/IN_REVIEW.
   */
  static async replaceReviewerAnnotatedPdf(
    fileId: string,
    userId: string,
    fileBuffer: Buffer,
    fileName: string
  ): Promise<FileRecord> {
    const safeName = truncateFileName(fileName);
    return transaction(async (client: PoolClient) => {
      const meta = await client.query<{
        id: string;
        tramite_id: string;
        ruta_blob: string | null;
        version: number;
        es_final: boolean;
        firmado: boolean;
        eliminado: boolean;
        estado: number;
      }>(
        `SELECT a.id, a.tramite_id, a.ruta_blob, a.version, a.es_final, a.firmado, a.eliminado,
                t.estado_id AS estado
         FROM archivos a
         JOIN tramites t ON t.id = a.tramite_id
         WHERE a.id = $1`,
        [fileId]
      );
      if (meta.rows.length === 0) {
        throw new ValidationError('Archivo no encontrado');
      }
      const row = meta.rows[0];
      if (row.eliminado) {
        throw new ValidationError('El archivo ya no está disponible');
      }
      if (row.es_final || row.firmado) {
        throw new ValidationError('No se pueden guardar anotaciones sobre un archivo firmado o final');
      }
      const appStatus = dbEstadoTramiteToApp(row.estado);
      if (appStatus !== 'SUBMITTED' && appStatus !== 'IN_REVIEW') {
        throw new ValidationError('Solo puede guardar anotaciones mientras el trámite está en revisión');
      }

      const blobStorage = getBlobStorage();
      if (row.ruta_blob) {
        try {
          await blobStorage.deleteFile(row.ruta_blob);
        } catch {
          /* blob previo ya inexistente */
        }
      }

      let blobUrl: string;
      let blobPath: string;
      try {
        const up = await blobStorage.uploadFile(
          row.tramite_id,
          safeName,
          fileBuffer,
          row.version,
          false
        );
        blobUrl = up.blobUrl;
        blobPath = up.blobPath;
      } catch (e) {
        console.error('[replaceReviewerAnnotatedPdf] Azure upload:', e);
        throw new AppError(
          503,
          'No se pudo guardar el archivo en almacenamiento. Compruebe Azure Storage o intente con un archivo más pequeño.'
        );
      }

      const mimeType = this.getMimeType(safeName);
      const fileType = this.inferFileTypeFromName(safeName);

      await client.query(
        `UPDATE archivos
         SET nombre_archivo = $1,
             tamano_archivo = $2,
             tipo_mime = $3,
             tipo_archivo = $4::file_type,
             url_blob = $5,
             ruta_blob = $6,
             subido_por = $7
         WHERE id = $8`,
        [safeName, fileBuffer.length, mimeType, fileType, blobUrl, blobPath, userId, fileId]
      );

      await client.query(
        `INSERT INTO registro_auditoria (tramite_id, usuario_id, accion, tipo_entidad, entidad_id, valor_nuevo)
         VALUES ($1, $2, 'FILE_UPLOADED', 'file', $3, $4)`,
        [
          row.tramite_id,
          userId,
          fileId,
          JSON.stringify({
            replaced: true,
            reviewAnnotation: true,
            fileName: safeName,
            size: fileBuffer.length,
          }),
        ]
      );

      const fresh = await client.query(
        `SELECT a.*, u.nombre || ' ' || u.apellido as uploaded_by_name
         FROM archivos a
         JOIN usuarios u ON a.subido_por = u.id
         WHERE a.id = $1`,
        [fileId]
      );
      return this.mapFileFromDb(fresh.rows[0] as unknown as Record<string, unknown>);
    });
  }

  static async ensureDirectorSigningRowsForCase(
    caseId: string,
    client?: PoolClient
  ): Promise<void> {
    const run = client ? (text: string, params?: unknown[]) => client.query(text, params) : query;
    await run(
      `INSERT INTO archivos_por_firmar (tramite_id, archivo_id, area_requerida_id, firmado)
       SELECT $1::uuid, a.id,
              (SELECT id FROM configuracion_areas WHERE activo = true AND puede_completar_tramite = true ORDER BY orden ASC LIMIT 1),
              false
       FROM archivos a
       WHERE a.tramite_id = $1::uuid
         AND a.eliminado = false
         AND COALESCE(a.es_final, false) = false
         AND NOT EXISTS (
           SELECT 1 FROM archivos_por_firmar x
           WHERE x.tramite_id = a.tramite_id AND x.archivo_id = a.id
         )
       ON CONFLICT (tramite_id, archivo_id) DO NOTHING`,
      [caseId]
    );
  }

  /**
   * Elimina un archivo (soft delete)
   */
  static async deleteFile(id: string): Promise<void> {
    await query(
      `UPDATE archivos
       SET eliminado = true, eliminado_en = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );
  }

  /**
   * Obtiene el historial de versiones de un archivo
   */
  static async getFileVersions(parentFileId: string): Promise<FileRecord[]> {
    const result = await query<FileRecord>(
      `WITH RECURSIVE file_tree AS (
        SELECT * FROM archivos WHERE id = $1
        UNION ALL
        SELECT a.* FROM archivos a
        INNER JOIN file_tree ft ON a.archivo_padre_id = ft.id
      )
      SELECT * FROM file_tree
      WHERE eliminado = false
      ORDER BY version ASC`,
      [parentFileId]
    );

    return result.rows.map((row) => this.mapFileFromDb(row as unknown as Record<string, unknown>));
  }

  private static inferFileTypeFromName(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'PDF';
    if (['png', 'jpg', 'jpeg'].includes(ext || '')) return 'IMAGE';
    if (['xls', 'xlsx'].includes(ext || '')) return 'SPREADSHEET';
    return 'DOCUMENT';
  }

  private static getMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  private static mapFileFromDb(row: Record<string, unknown>): FileRecord {
    return {
      id: row.id as string,
      caseId: row.tramite_id as string,
      fileName: row.nombre_archivo as string,
      fileType: row.tipo_archivo as FileRecord['fileType'],
      fileSize: row.tamano_archivo as number,
      mimeType: row.tipo_mime as string,
      description: row.descripcion as string | undefined,
      signatureReason: row.motivo_firma as string | undefined,
      blobUrl: row.url_blob as string,
      blobPath: row.ruta_blob as string,
      version: row.version as number,
      parentFileId: row.archivo_padre_id as string | undefined,
      isFinal: row.es_final === true,
      isSigned: row.firmado === true,
      signedSourceFileId: (row.archivo_fuente_firmado_id as string | null | undefined) ?? undefined,
      isDeleted: row.eliminado as boolean,
      isCreationUpload: row.es_carga_inicial === true,
      uploadedBy: row.subido_por as string,
      uploadedByName: row.uploaded_by_name as string,
      uploadedAt: row.subido_en as Date,
      deletedAt: row.eliminado_en as Date | undefined,
      createdAt: row.subido_en as Date,
    };
  }
}
