import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';

class AzureBlobStorage {
  private blobServiceClient: BlobServiceClient;
  private containerClient: ContainerClient;
  private containerName: string;

  constructor() {
    const account = process.env.AZURE_STORAGE_ACCOUNT;
    const key = process.env.AZURE_STORAGE_KEY;
    this.containerName = process.env.AZURE_CONTAINER_NAME || 'gestion-archivos';

    if (!account || !key) {
      throw new Error('Azure Storage credentials no configuradas');
    }

    // Construir connection string
    const connectionString = `DefaultEndpointsProtocol=https;AccountName=${account};AccountKey=${key};EndpointSuffix=core.windows.net`;
    
    this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    this.containerClient = this.blobServiceClient.getContainerClient(this.containerName);
  }

  /**
   * Inicializa el contenedor si no existe
   */
  async ensureContainer(): Promise<void> {
    const exists = await this.containerClient.exists();
    if (!exists) {
      await this.containerClient.create();
      console.log(`Contenedor ${this.containerName} creado`);
    }
  }

  /**
   * Sube un archivo a Azure Blob Storage
   * @param caseId - ID del trámite
   * @param fileName - Nombre del archivo
   * @param buffer - Buffer del archivo
   * @param version - Versión del archivo
   * @param isFinal - Si es archivo final firmado
   * @returns URL del blob y path completo
   */
  async uploadFile(
    caseId: string,
    fileName: string,
    buffer: Buffer,
    version: number = 1,
    isFinal: boolean = false
  ): Promise<{ blobUrl: string; blobPath: string }> {
    await this.ensureContainer();

    // Estructura: case-{id}/v{version}/filename o case-{id}/final/filename
    const folder = isFinal ? 'final' : `v${version}`;
    const blobPath = `case-${caseId}/${folder}/${fileName}`;
    
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobPath);
    
    // Detectar content type
    const contentType = this.getContentType(fileName);
    
    await blockBlobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: {
        blobContentType: contentType,
      },
    });

    return {
      blobUrl: blockBlobClient.url,
      blobPath,
    };
  }

  /**
   * Descarga un archivo desde Azure Blob Storage
   */
  async downloadFile(blobPath: string): Promise<Buffer> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobPath);
    const downloadResponse = await blockBlobClient.download();
    
    if (!downloadResponse.readableStreamBody) {
      throw new Error('No se pudo descargar el archivo');
    }

    return await this.streamToBuffer(downloadResponse.readableStreamBody);
  }

  /**
   * Elimina un archivo de Azure Blob Storage
   */
  async deleteFile(blobPath: string): Promise<void> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobPath);
    await blockBlobClient.delete();
  }

  /**
   * Obtiene la URL de un blob con SAS token (acceso temporal)
   */
  async getFileUrl(blobPath: string, expiresInMinutes: number = 60): Promise<string> {
    void expiresInMinutes;
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobPath);
    
    // En producción, generar SAS token
    // Por ahora retornamos la URL directa
    return blockBlobClient.url;
  }

  /**
   * Sube documento contractual HBI (paquete por operación/crédito)
   */
  async uploadHbiDocumento(
    operacionId: string,
    fileName: string,
    buffer: Buffer
  ): Promise<{ blobUrl: string; blobPath: string }> {
    await this.ensureContainer();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const blobPath = `hbi-operacion-${operacionId}/contractual/${safeName}`;
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobPath);
    const contentType = this.getContentType(fileName);
    await blockBlobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: { blobContentType: contentType },
    });
    return { blobUrl: blockBlobClient.url, blobPath };
  }

  /**
   * Lista todos los archivos de un trámite
   */
  async listCaseFiles(caseId: string): Promise<string[]> {
    const prefix = `case-${caseId}/`;
    const files: string[] = [];

    for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
      files.push(blob.name);
    }

    return files;
  }

  /**
   * Elimina todos los blobs cuyo nombre comienza por `prefix` (p. ej. `case-` para todos los trámites).
   */
  async deleteBlobsByPrefix(prefix: string): Promise<number> {
    let count = 0;
    for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
      await this.containerClient.deleteBlob(blob.name);
      count++;
    }
    return count;
  }

  /**
   * Convierte un stream a buffer
   */
  private async streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      readableStream.on('data', (data) => {
        chunks.push(data instanceof Buffer ? data : Buffer.from(data));
      });
      readableStream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      readableStream.on('error', reject);
    });
  }

  /**
   * Detecta el content type basado en la extensión
   */
  private getContentType(fileName: string): string {
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
      gif: 'image/gif',
      txt: 'text/plain',
      zip: 'application/zip',
    };

    return mimeTypes[ext || ''] || 'application/octet-stream';
  }
}

// Singleton instance
let blobStorageInstance: AzureBlobStorage | null = null;

export function getBlobStorage(): AzureBlobStorage {
  if (!blobStorageInstance) {
    blobStorageInstance = new AzureBlobStorage();
  }
  return blobStorageInstance;
}

export default AzureBlobStorage;
