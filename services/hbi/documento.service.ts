import { query } from '@/lib/db';
import { getBlobStorage } from '@/lib/azure/blob-storage';
import { clasificarDocumentoPorNombre } from '@/lib/hbi/classify-document';
import { extraerDatosClaveDocumento } from '@/lib/hbi/extract-document-metadata';
import { MotorOperativoService } from '@/services/hbi/motor-operativo.service';
import type { DocumentoContractual, TipoDocumentoContractual } from '@/types/hbi/operacion.types';

type DocRow = {
  id: string;
  operacion_id: string;
  tipo_documento: TipoDocumentoContractual;
  nombre_archivo: string;
  mime_type: string | null;
  tamano_bytes: string | null;
  blob_url: string | null;
  datos_extraidos: Record<string, unknown>;
  clasificacion_confianza: string | null;
  creado_en: string;
};

function mapDoc(row: DocRow): DocumentoContractual {
  return {
    id: row.id,
    operacionId: row.operacion_id,
    tipoDocumento: row.tipo_documento,
    nombreArchivo: row.nombre_archivo,
    mimeType: row.mime_type ?? undefined,
    tamanoBytes: row.tamano_bytes ? Number(row.tamano_bytes) : undefined,
    blobUrl: row.blob_url ?? undefined,
    datosExtraidos: row.datos_extraidos ?? {},
    creadoEn: row.creado_en,
  };
}

export class DocumentoHbiService {
  static async listar(operacionId: string): Promise<DocumentoContractual[]> {
    const r = await query<DocRow>(
      `SELECT * FROM documentos_contractuales WHERE operacion_id = $1 ORDER BY creado_en DESC`,
      [operacionId]
    );
    return r.rows.map(mapDoc);
  }

  static async subir(input: {
    operacionId: string;
    fileName: string;
    buffer: Buffer;
    mimeType?: string;
    tipoManual?: TipoDocumentoContractual;
    usuarioId: string;
  }): Promise<DocumentoContractual> {
    const clasif = input.tipoManual
      ? { tipo: input.tipoManual, confianza: 1 }
      : clasificarDocumentoPorNombre(input.fileName);
    const extraidos = extraerDatosClaveDocumento(input.fileName, clasif.tipo);

    let blobUrl: string | null = null;
    let blobPath: string | null = null;
    try {
      const blob = getBlobStorage();
      const up = await blob.uploadHbiDocumento(input.operacionId, input.fileName, input.buffer);
      blobUrl = up.blobUrl;
      blobPath = up.blobPath;
    } catch {
      // Permite registro local si Azure no está configurado en desarrollo
    }

    const ins = await query<DocRow>(
      `INSERT INTO documentos_contractuales (
        operacion_id, tipo_documento, nombre_archivo, mime_type, tamano_bytes,
        blob_url, blob_path, datos_extraidos, clasificacion_confianza, subido_por
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        input.operacionId,
        clasif.tipo,
        input.fileName,
        input.mimeType ?? null,
        input.buffer.length,
        blobUrl,
        blobPath,
        JSON.stringify(extraidos),
        clasif.confianza,
        input.usuarioId,
      ]
    );

    await query(
      `INSERT INTO historial_operacion (operacion_id, usuario_id, tipo_evento, detalle, comentario)
       VALUES ($1, $2, 'DOCUMENTO_SUBIDO', $3, $4)`,
      [
        input.operacionId,
        input.usuarioId,
        JSON.stringify({ tipo: clasif.tipo, archivo: input.fileName }),
        `Documento clasificado como ${clasif.tipo}`,
      ]
    );

    await MotorOperativoService.sincronizarOperacion(input.operacionId);
    return mapDoc(ins.rows[0]);
  }
}
