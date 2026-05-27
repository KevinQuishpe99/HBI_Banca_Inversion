export type FileType = 
  | 'DOCUMENT'
  | 'IMAGE'
  | 'PDF'
  | 'SPREADSHEET'
  | 'OTHER';

export interface FileRecord {
  id: string;
  caseId: string;
  fileName: string;
  fileType: FileType;
  fileSize: number;
  mimeType?: string;
  description?: string;
  signatureReason?: string;
  blobUrl: string;
  blobPath: string;
  version: number;
  parentFileId?: string;
  isFinal: boolean;
  /** true cuando es un archivo firmado por Director General */
  isSigned: boolean;
  /** id del archivo original para el que se generó esta versión firmada */
  signedSourceFileId?: string;
  isDeleted: boolean;
  /** Subido al crear el trámite; no se puede eliminar */
  isCreationUpload: boolean;
  uploadedBy: string;
  /** Nombre legible (JOIN en consultas de listado) */
  uploadedByName?: string;
  uploadedAt: Date;
  /** Duplicado de `uploadedAt` en algunos listados/API */
  createdAt?: Date;
  deletedAt?: Date;
}

export interface UploadFileDTO {
  caseId: string;
  fileName: string;
  fileType: FileType;
  description?: string;
  signatureReason?: string;
  file: File;
  parentFileId?: string;
}

export interface UploadFileData {
  caseId: string;
  fileName: string;
  fileType: FileType;
  description?: string;
  signatureReason?: string;
  parentFileId?: string;
  /** Solo true al crear el trámite; esos archivos no son eliminables */
  isCreationUpload?: boolean;
}

export interface FileVersion {
  version: number;
  fileName: string;
  uploadedBy: string;
  uploadedAt: Date;
  fileSize: number;
  blobUrl: string;
}
