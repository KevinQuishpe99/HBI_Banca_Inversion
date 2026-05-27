'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  File as FileIcon,
  Download,
  Loader2,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Eye,
  Pen,
  X,
  Upload,
  Trash2,
  Lock,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useUploadFile } from '@/hooks/useUploadFile';
import { Swal, escapeSwalHtml } from '@/lib/ui/swal';
import { useToast } from '@/hooks/useToast';
import { Toast } from '@/components/shared/Toast';
import { areaLabels } from '@/components/admin/user-management/labels';
import { ReviewActionsDescription } from '@/components/flow/ReviewActionsDescription';
import { useAreaMeta } from '@/hooks/useAreaLabelByCode';
import { isAllowedSignedDocumentFileName } from '@/lib/validations/file.schema';

const PdfAnnotatorViewer = dynamic(
  () => import('@/components/files/PdfAnnotatorViewer').then((m) => m.PdfAnnotatorViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-48 w-full items-center justify-center rounded-lg bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    ),
  }
);

const DocxReviewReplacePanel = dynamic(
  () => import('@/components/files/DocxReviewReplacePanel').then((m) => m.DocxReviewReplacePanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-48 w-full max-w-lg items-center justify-center rounded-lg bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    ),
  }
);

interface FileData {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  mimeType?: string;
  blobUrl: string;
  uploadedBy: string;
  uploadedByName: string;
  version: number;
  createdAt: string;
   isFinal?: boolean;
   isSigned?: boolean;
   signedSourceFileId?: string | null;
  /** Archivo subido al crear el trámite; no eliminable */
  isCreationUpload?: boolean;
}

type FileCommentItem = {
  id: string;
  fileId: string;
  content: string;
  createdAt: string;
  authorName: string;
  userArea: string | null;
};

/** Copia firmada elegida (antes de guardar): nombre, quitar y vista previa PDF en modal (mismo patrón que el trámite). */
function PendingSignedDraftPreview({ draft, onRemove }: { draft: File; onRemove: () => void }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const esPdf = draft.name.toLowerCase().endsWith('.pdf');
  const urlBlob = useMemo(() => {
    if (!previewOpen || !esPdf) return null;
    return URL.createObjectURL(draft);
  }, [previewOpen, esPdf, draft]);

  useEffect(() => {
    return () => {
      if (urlBlob) URL.revokeObjectURL(urlBlob);
    };
  }, [urlBlob]);

  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewOpen]);

  return (
    <>
      <div className="mt-3 rounded-md border border-emerald-300 bg-emerald-50/90 px-3 py-2.5 shadow-sm">
        <p className="truncate text-xs font-medium text-emerald-900/90">{draft.name}</p>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-emerald-400/80 bg-white text-emerald-900 transition-colors hover:bg-emerald-100/80 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
            aria-label="Abrir vista previa del PDF en ventana"
            title="Vista previa (modal)"
          >
            <Eye className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 rounded-md border border-emerald-400/80 bg-white px-2 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100/80"
            title="Quitar archivo seleccionado"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </button>
        </div>
      </div>

      {previewOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="signed-draft-preview-title"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 sm:px-5">
              <h3
                id="signed-draft-preview-title"
                className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 sm:text-base"
              >
                {draft.name}
              </h3>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                title="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-gray-100 p-2 sm:p-4">
              {urlBlob ? (
                <iframe
                  title={`Vista previa: ${draft.name}`}
                  src={urlBlob}
                  className="h-[75vh] max-h-[720px] w-full min-h-[400px] rounded-md border border-gray-200 bg-white"
                />
              ) : (
                <div className="flex min-h-[280px] flex-col items-center justify-center rounded-md border border-amber-200 bg-amber-50 px-4 py-8 text-center">
                  <FileText className="mb-3 h-10 w-10 text-amber-700" aria-hidden />
                  <p className="max-w-md text-sm text-amber-950">
                    <span className="font-medium">Vista previa solo para PDF.</span> Este archivo es Word; confirme el
                    contenido en su equipo antes de guardar.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function getPreviewKind(file: FileData): 'pdf' | 'word' | 'image' | 'text' | 'none' {
  const mime = (file.mimeType || '').toLowerCase();
  const name = file.fileName.toLowerCase();
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mime === 'application/msword' ||
    name.endsWith('.docx') ||
    name.endsWith('.doc')
  ) {
    return 'word';
  }
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('text/') || name.endsWith('.txt')) return 'text';
  return 'none';
}

/** PDF: anotador en navegador. Word: subir .doc/.docx revisado (mismo endpoint y permisos que PDF). */
function canAnnotateReviewRow(file: FileData, caseStatus: string, canComment: boolean): boolean {
  const kind = getPreviewKind(file);
  if (kind !== 'pdf' && kind !== 'word') return false;
  return (
    canComment &&
    !file.isSigned &&
    !file.isFinal &&
    (caseStatus === 'SUBMITTED' || caseStatus === 'IN_REVIEW')
  );
}

function filterAcceptedFiles(fileList: File[]): File[] {
  return fileList.filter((f) => {
    const n = f.name.toLowerCase();
    return (
      n.endsWith('.pdf') ||
      n.endsWith('.doc') ||
      n.endsWith('.docx') ||
      n.endsWith('.xls') ||
      n.endsWith('.xlsx') ||
      n.endsWith('.png') ||
      n.endsWith('.jpg') ||
      n.endsWith('.jpeg') ||
      n.endsWith('.txt')
    );
  });
}

async function replaceFileRequest(fileId: string, file: File): Promise<void> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`/api/files/${fileId}/replace`, { method: 'POST', body: form });
  const j = await res.json().catch(() => ({} as { error?: string }));
  if (!res.ok) throw new Error(j?.error || 'No se pudo reemplazar el archivo');
}

type Props = {
  caseId: string;
  canUpload: boolean;
  caseStatus: string;
  /** Creador con trámite devuelto y área que permitió actualizar archivos: sustituir binario sin perder comentarios */
  canReplaceReturnedFiles?: boolean;
  canDeleteNonInitialFiles: boolean;
  /** Director General puede eliminar copias firmadas (cualquier firma requerida de director) */
  canDeleteSignedAsDirector?: boolean;
  /** Legal con firma habilitada puede eliminar copias firmadas cuando la firma requerida es Legal */
  canDeleteSignedAsLegal?: boolean;
  canCommentFile: boolean;
  /** Solo Legal/Admin pueden marcar archivos para firma del Director */
  canMarkForSigning?: boolean;
  /** Legal o Admin pueden subir la copia firmada cuando la firma es del área Legal */
  canUploadSignedAsLegal?: boolean;
  /** Director General o Admin cuando la firma corresponde al Director */
  canUploadSignedAsDirector?: boolean;
  /** Mostrar columna de firmados (Legal, Director, Admin y usuario general) */
  canViewSignedFiles?: boolean;
  /** Descargar archivo base: supervisor Legal/Director, firmantes habilitados o admin. */
  canDownloadFiles?: boolean;
  /** Descargar copia firmada: creador, firmantes habilitados o admin. */
  canDownloadSignedFiles?: boolean;
  /** Heartbeat de bloqueo de anotación en PDF (usuarios de área con paso activo). */
  useAnnotationLock?: boolean;
};

export function CaseFilesPanel({
  caseId,
  canUpload,
  caseStatus,
  canReplaceReturnedFiles = false,
  canDeleteNonInitialFiles,
  canDeleteSignedAsDirector = false,
  canDeleteSignedAsLegal = false,
  canCommentFile,
  canMarkForSigning = false,
  canUploadSignedAsLegal = false,
  canUploadSignedAsDirector = false,
  canViewSignedFiles = false,
  canDownloadFiles = false,
  canDownloadSignedFiles = false,
  useAnnotationLock = false,
}: Props) {
  const [previewFile, setPreviewFile] = useState<FileData | null>(null);
  /** Vista previa solo lectura o anotador (lápiz). */
  const [previewOpenMode, setPreviewOpenMode] = useState<'view' | 'annotate'>('view');
  /** Guardado de anotaciones PDF en curso: no cerrar modal ni Escape. */
  const [annotatorSaving, setAnnotatorSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  /** Con trámite devuelto: reemplazos en cola hasta «Guardar archivos» (mismo id en BD al confirmar). */
  const [pendingReplaces, setPendingReplaces] = useState<Record<string, File>>({});
  const [isSavingPending, setIsSavingPending] = useState(false);
  const [signedDraftBySource, setSignedDraftBySource] = useState<Record<string, File | undefined>>({});
  const [signerAreaByFile, setSignerAreaByFile] = useState<Record<string, 'LEGAL' | 'DIRECTOR_GENERAL'>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentsOpenByFile, setCommentsOpenByFile] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetIdRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const uploadMutation = useUploadFile();
  const { toasts, hideToast, error: showError, success: showSuccess } = useToast();
  const { areaLabelByCode } = useAreaMeta();

  /** API devuelve `userArea` como id de área (`id::text`); meta tiene la etiqueta. */
  const labelForCommentArea = useCallback(
    (areaKey: string | number | null | undefined) => {
      if (areaKey == null || areaKey === '') return '';
      const k = String(areaKey).trim();
      if (!k) return '';
      return areaLabelByCode[k] ?? areaLabels[k] ?? k;
    },
    [areaLabelByCode]
  );

  const isStagedMode = caseStatus === 'RETURNED' && canUpload;

  /** Reemplazo inmediato solo si no hay modo cola (trámite devuelto usa cola + Guardar archivos). */
  const replaceMutation = useMutation({
    meta: { lockMessage: 'Reemplazando archivo…' },
    mutationFn: async ({ fileId, file }: { fileId: string; file: File }) => {
      await replaceFileRequest(fileId, file);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', caseId] });
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      showSuccess('Archivo actualizado correctamente.');
    },
    onError: (e: Error) => showError(e.message),
  });

  const deleteMutation = useMutation({
    meta: { lockMessage: 'Eliminando archivo…' },
    mutationFn: async (fileId: string) => {
      const res = await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(err?.error || 'Error al eliminar el archivo');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', caseId] });
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
    },
  });

  const { data: files, isLoading, error } = useQuery<FileData[]>({
    queryKey: ['files', caseId],
    queryFn: async () => {
      const response = await fetch(`/api/cases/${caseId}/files`);
      if (!response.ok) throw new Error('Error al cargar archivos');
      const data = await response.json();
      return data.data;
    },
  });

  const { data: fileComments } = useQuery<FileCommentItem[]>({
    queryKey: ['file-comments', caseId],
    queryFn: async () => {
      const response = await fetch(`/api/cases/${caseId}/file-comments`);
      if (!response.ok) throw new Error('Error al cargar comentarios');
      const data = await response.json();
      return data.data as FileCommentItem[];
    },
  });

  const commentsByFile = useMemo(() => {
    const map = new Map<string, FileCommentItem[]>();
    for (const c of fileComments ?? []) {
      const arr = map.get(c.fileId) ?? [];
      arr.push(c);
      map.set(c.fileId, arr);
    }
    return map;
  }, [fileComments]);

  const lastCommentByFileArea = useMemo(() => {
    const map = new Map<string, Map<string, FileCommentItem>>();
    for (const c of fileComments ?? []) {
      if (!c.userArea) continue;
      const byArea = map.get(c.fileId) ?? new Map<string, FileCommentItem>();
      // Como vienen ordenados por fecha ascendente, ir sobrescribiendo deja el último
      byArea.set(c.userArea, c);
      map.set(c.fileId, byArea);
    }
    return map;
  }, [fileComments]);

  type FileToSign = {
    id: string;
    fileId: string;
    isSigned: boolean;
    requiredByArea?: 'LEGAL' | 'DIRECTOR_GENERAL';
  };

  const { data: filesToSign } = useQuery<FileToSign[]>({
    queryKey: ['files-to-sign', caseId],
    queryFn: async () => {
      const res = await fetch(`/api/cases/${caseId}/files-to-sign`);
      if (!res.ok) throw new Error('Error al cargar archivos marcados para firma');
      const json = await res.json();
      return (json?.data || []) as FileToSign[];
    },
  });

  const hasPendingCommentDrafts = useMemo(
    () => Object.values(commentDrafts).some((t) => (t ?? '').trim().length > 0),
    [commentDrafts]
  );

  const hasPendingSignedDrafts = useMemo(
    () => Object.values(signedDraftBySource).some((f) => f instanceof File),
    [signedDraftBySource]
  );

  /** Cambio de «Definir firma» sin guardar aún (se aplica al pulsar Guardar junto a comentarios). */
  const hasPendingSignerDrafts = useMemo(() => {
    if (!canMarkForSigning) return false;
    const fts = filesToSign ?? [];
    const fl = files ?? [];
    for (const file of fl) {
      if (file.isFinal && file.isSigned) continue;
      const hasSignedPair = fl.some(
        (s) => s.signedSourceFileId === file.id && s.isFinal && s.isSigned
      );
      if (hasSignedPair) continue;
      const toSign = fts.find((t) => t.fileId === file.id);
      const baseline = toSign?.requiredByArea ?? 'DIRECTOR_GENERAL';
      const draft = signerAreaByFile[file.id];
      if (draft !== undefined && draft !== baseline) return true;
    }
    return false;
  }, [canMarkForSigning, files, filesToSign, signerAreaByFile]);

  const hasPendingToSave =
    hasPendingCommentDrafts || hasPendingSignedDrafts || hasPendingSignerDrafts;

  const canUseGlobalSave =
    canCommentFile ||
    canUploadSignedAsLegal ||
    canUploadSignedAsDirector ||
    canMarkForSigning;

  const saveAllPendingMutation = useMutation({
    meta: { lockMessage: 'Guardando archivos…' },
    mutationFn: async () => {
      const commentEntries = Object.entries(commentDrafts).filter(([, t]) => (t ?? '').trim().length > 0);
      const signEntries = Object.entries(signedDraftBySource).filter(
        (entry): entry is [string, File] => entry[1] instanceof File
      );

      const fileList = files ?? [];
      const fts = filesToSign ?? [];
      const signerPending: { fileId: string; signerArea: 'LEGAL' | 'DIRECTOR_GENERAL' }[] = [];
      for (const file of fileList) {
        if (file.isFinal && file.isSigned) continue;
        const hasSignedPair = fileList.some(
          (s) => s.signedSourceFileId === file.id && s.isFinal && s.isSigned
        );
        if (hasSignedPair) continue;
        if (!canMarkForSigning) continue;
        const toSign = fts.find((t) => t.fileId === file.id);
        const baseline = toSign?.requiredByArea ?? 'DIRECTOR_GENERAL';
        const draft = signerAreaByFile[file.id];
        if (draft !== undefined && draft !== baseline) {
          signerPending.push({ fileId: file.id, signerArea: draft });
        }
      }

      if (!commentEntries.length && !signEntries.length && !signerPending.length) return;

      if (commentEntries.length && !canCommentFile) {
        throw new Error('No tiene permiso para guardar comentarios');
      }
      if (signEntries.length && !canUploadSignedAsLegal && !canUploadSignedAsDirector) {
        throw new Error('No tiene permiso para subir documentos firmados');
      }
      if (signerPending.length && !canMarkForSigning) {
        throw new Error('No tiene permiso para guardar la definición de firma');
      }

      for (const [fileId, text] of commentEntries) {
        const res = await fetch(`/api/files/${fileId}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: text.trim() }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({} as { error?: string }));
          throw new Error(err?.error || 'Error al guardar comentarios');
        }
      }

      for (const { fileId, signerArea } of signerPending) {
        const res = await fetch(`/api/cases/${caseId}/files-to-sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId, shouldSign: true, signerArea }),
        });
        const json = await res.json().catch(() => ({} as { error?: string }));
        if (!res.ok) {
          throw new Error(json?.error || 'Error al guardar quién debe firmar');
        }
      }

      for (const [sourceId, signed] of signEntries) {
        const source = fileList.find((f) => f.id === sourceId);
        if (!source) continue;
        const form = new FormData();
        form.append('file', signed);
        const res = await fetch(`/api/files/${source.id}/signed`, {
          method: 'POST',
          body: form,
        });
        const json = await res.json().catch(() => ({} as { error?: string }));
        if (!res.ok) {
          throw new Error(json?.error || 'Error al subir documento firmado');
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file-comments', caseId] });
      queryClient.invalidateQueries({ queryKey: ['files', caseId] });
      queryClient.invalidateQueries({ queryKey: ['files-to-sign', caseId] });
      setCommentDrafts({});
      setSignerAreaByFile({});
      setSignedDraftBySource((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          if (next[k]) delete next[k];
        }
        return next;
      });
      showSuccess(
        'Guardado. Use Aprobar o Devolver para registrar la decisión en el flujo; Guardar en Archivos no sustituye esas acciones.'
      );
    },
    onError: (e: Error) => showError(e.message),
  });

  const uploadFilesImmediate = useCallback(
    async (fileList: File[]) => {
      if (!canUpload || !fileList.length) return;
      const accepted = filterAcceptedFiles(fileList);
      for (const file of accepted) {
        await uploadMutation.mutateAsync({
          caseId,
          fileName: file.name,
          fileType: 'DOCUMENT',
          file,
        });
      }
    },
    [canUpload, caseId, uploadMutation]
  );

  const queueOrUpload = useCallback(
    (fileList: File[]) => {
      if (!canUpload || !fileList.length) return;
      const accepted = filterAcceptedFiles(fileList);
      if (!accepted.length) return;
      if (isStagedMode) {
        setPendingFiles((prev) => [...prev, ...accepted]);
      } else {
        void uploadFilesImmediate(accepted);
      }
    },
    [canUpload, isStagedMode, uploadFilesImmediate]
  );

  const savePendingFiles = useCallback(async () => {
    if (!isStagedMode) return;
    if (!pendingFiles.length && !Object.keys(pendingReplaces).length) return;
    const filesSnapshot = [...pendingFiles];
    const replaceSnapshot = { ...pendingReplaces };
    setIsSavingPending(true);
    try {
      for (const file of filesSnapshot) {
        await uploadMutation.mutateAsync({
          caseId,
          fileName: file.name,
          fileType: 'DOCUMENT',
          file,
        });
      }
      setPendingFiles([]);
      for (const [fileId, file] of Object.entries(replaceSnapshot)) {
        await replaceFileRequest(fileId, file);
      }
      setPendingReplaces({});
      await queryClient.invalidateQueries({ queryKey: ['files', caseId] });
      await queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      await queryClient.invalidateQueries({ queryKey: ['file-comments', caseId] });
      showSuccess('Cambios guardados: archivos nuevos en expediente y reemplazos aplicados en la base.');
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : 'Error al guardar archivos');
    } finally {
      setIsSavingPending(false);
    }
  }, [pendingFiles, pendingReplaces, isStagedMode, caseId, uploadMutation, showError, showSuccess, queryClient]);

  const removePendingAt = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    queueOrUpload(list);
    e.target.value = '';
  };

  const onReplaceFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = replaceTargetIdRef.current;
    replaceTargetIdRef.current = null;
    e.target.value = '';
    if (!file || !id) return;
    const accepted = filterAcceptedFiles([file]);
    if (!accepted.length) {
      showError('Tipo de archivo no permitido');
      return;
    }
    if (isStagedMode) {
      setPendingReplaces((prev) => ({ ...prev, [id]: accepted[0] }));
    } else {
      void replaceMutation.mutateAsync({ fileId: id, file: accepted[0] });
    }
  };

  const removePendingReplace = (fileId: string) => {
    setPendingReplaces((prev) => {
      const next = { ...prev };
      delete next[fileId];
      return next;
    });
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'PDF':
        return <FileText className="w-8 h-8 text-red-500" />;
      case 'IMAGE':
        return <ImageIcon className="w-8 h-8 text-blue-500" />;
      case 'SPREADSHEET':
        return <FileSpreadsheet className="w-8 h-8 text-green-500" />;
      default:
        return <FileIcon className="w-8 h-8 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const closePreview = useCallback(() => {
    if (annotatorSaving) return;
    setAnnotatorSaving(false);
    setPreviewOpenMode('view');
    setPreviewFile(null);
  }, [annotatorSaving]);

  useEffect(() => {
    if (!previewFile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !annotatorSaving) closePreview();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewFile, closePreview, annotatorSaving]);

  const handleDownload = (file: FileData) => {
    const link = document.createElement('a');
    link.href = `/api/files/${file.id}?download=1`;
    link.download = file.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openPreviewView = (file: FileData) => {
    if (getPreviewKind(file) === 'none') return;
    setPreviewOpenMode('view');
    setPreviewFile(file);
  };

  const openPreviewAnnotate = async (file: FileData) => {
    if (!canAnnotateReviewRow(file, caseStatus, canCommentFile)) return;
    if (useAnnotationLock) {
      const res = await fetch(`/api/files/${file.id}/annotation-lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'acquire' }),
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      const d = json?.data as
        | { ok?: boolean; blocked?: boolean; message?: string }
        | undefined;
      if (!res.ok) {
        showError((json as { error?: string })?.error || 'No se pudo reservar la anotación');
        return;
      }
      if (d?.blocked || d?.ok === false) {
        showError(
          d?.message ||
            'Otro usuario está anotando este archivo. Solo puede visualizar y no editar todavía; espere a que la otra área termine de editar.',
        );
        return;
      }
    }
    setPreviewOpenMode('annotate');
    setPreviewFile(file);
  };

  const requestDelete = (file: FileData) => {
    if (file.isCreationUpload) return;
    const signedNote = file.isSigned
      ? 'Esto quitará el documento firmado y deberá volver a subirlo.'
      : 'Esta acción no se puede deshacer.';
    void Swal.fire({
      title: file.isSigned ? '¿Eliminar archivo firmado?' : '¿Eliminar archivo?',
      html: `¿Está seguro de que desea eliminar <strong>${escapeSwalHtml(file.fileName)}</strong>? ${signedNote}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      reverseButtons: true,
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async () => {
        try {
          await deleteMutation.mutateAsync(file.id);
          if (previewFile?.id === file.id) setPreviewFile(null);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Error al eliminar el archivo';
          Swal.showValidationMessage(msg);
          return false;
        }
      },
    });
  };

  const previewSrc = previewFile ? `/api/files/${previewFile.id}` : null;
  const previewKind = previewFile ? getPreviewKind(previewFile) : 'none';
  const showReviewAnnotator =
    !!previewFile &&
    previewOpenMode === 'annotate' &&
    canAnnotateReviewRow(previewFile, caseStatus, canCommentFile);
  const showPdfAnnotator = showReviewAnnotator && previewKind === 'pdf';
  const showDocxReviewPanel = showReviewAnnotator && previewKind === 'word';

  const list = useMemo(() => files ?? [], [files]);
  const signedPairs = useMemo(() => {
    const byId = new Map<string, FileData>();
    for (const f of list) byId.set(f.id, f);
    return list
      .filter((f) => f.isFinal && f.isSigned && f.signedSourceFileId)
      .map((signed) => ({
        base: byId.get(String(signed.signedSourceFileId)) || null,
        signed,
      }));
  }, [list]);
  const signedBySourceId = useMemo<Map<string, FileData>>(() => {
    const map: Map<string, FileData> = new Map();
    for (const p of signedPairs) {
      if (p.base?.id) map.set(p.base.id, p.signed);
    }
    return map;
  }, [signedPairs]);
  return (
    <>
      <input
        ref={replaceInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
        onChange={onReplaceFilePicked}
      />
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {caseStatus === 'RETURNED' ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">Trámite devuelto — corrección requerida</p>
            <p className="mt-1 text-xs text-amber-900/85">
              El detalle de cada devolución y motivos está en la pestaña «Proceso de revisión».
            </p>
            {canReplaceReturnedFiles ? (
              <p className="mt-2 text-xs text-amber-900/85">
                Use «Reemplazar» en cada fila para elegir el nuevo documento; quedará en cola hasta que pulse «Guardar
                archivos» junto a «Lista de archivos» — los comentarios del área se conservan al guardar.
              </p>
            ) : null}
            {isStagedMode ? (
              <p className="mt-2 text-xs text-amber-900/85">
                Seleccione archivos y pulse «Guardar archivos» (a la derecha de «Lista de archivos») para subirlos;
                puede preparar varios documentos antes de reenviar.
              </p>
            ) : null}
          </div>
            ) : null}

        {caseStatus === 'SUBMITTED' || caseStatus === 'IN_REVIEW' ? (
          <div className="border-b border-gray-200 px-4 py-3 sm:px-5">
            <ReviewActionsDescription className="mb-0 mt-0" context="filesTab" />
          </div>
        ) : null}

        {canUpload ? (
          <div className="border-b border-gray-200 p-3 sm:p-4">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
              onChange={onInputChange}
            />
            <button
              type="button"
              disabled={uploadMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
                queueOrUpload(Array.from(e.dataTransfer.files));
              }}
              className={`flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {uploadMutation.isPending ? (
                <Loader2 className="mb-2 h-10 w-10 animate-spin text-blue-600" />
              ) : (
                <Upload className="mb-2 h-10 w-10 text-gray-400" />
              )}
              <p className="text-center text-sm text-gray-600">
                <span className="font-semibold text-gray-800">Clic para elegir archivos</span> o arrástrelos aquí
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {isStagedMode
                  ? 'Archivos nuevos y reemplazos quedan en cola hasta pulsar «Guardar archivos» (se aplican en la base al guardar).'
                  : 'Se suben al soltar o al seleccionar'}
              </p>
            </button>

            {isStagedMode && (pendingFiles.length > 0 || Object.keys(pendingReplaces).length > 0) ? (
              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-3">
                <p className="text-sm font-medium text-gray-900">
                  Pendiente de guardar (
                  {pendingFiles.length + Object.keys(pendingReplaces).length})
                </p>
                {pendingFiles.length > 0 ? (
                  <>
                    <p className="mt-1 text-xs font-medium text-gray-600">Nuevos documentos</p>
                    <ul className="mt-1 space-y-1">
                      {pendingFiles.map((f, i) => (
                        <li
                          key={`${f.name}-${i}`}
                          className="flex items-center justify-between gap-2 text-sm text-gray-700"
                        >
                          <span className="min-w-0 truncate">{f.name}</span>
                          <button
                            type="button"
                            disabled={isSavingPending || uploadMutation.isPending}
                            onClick={() => removePendingAt(i)}
                            className="inline-flex flex-shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                            title="Eliminar de la cola"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Eliminar
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {Object.keys(pendingReplaces).length > 0 ? (
                  <>
                    <p className="mt-3 text-xs font-medium text-gray-600">Reemplazar documento existente</p>
                    <ul className="mt-1 space-y-1">
                      {Object.entries(pendingReplaces).map(([fid, replFile]) => {
                        const baseName = files?.find((x) => x.id === fid)?.fileName ?? 'documento';
                        return (
                          <li key={fid} className="flex items-center justify-between gap-2 text-sm text-gray-700">
                            <span className="min-w-0 truncate" title="Se aplicará al pulsar Guardar archivos">
                              «{baseName}» → {replFile.name}
                            </span>
                            <button
                              type="button"
                              disabled={isSavingPending || uploadMutation.isPending}
                              onClick={() => removePendingReplace(fid)}
                              className="inline-flex flex-shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                              title="Quitar de la cola"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Quitar
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="border-b border-gray-200 px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900">Lista de archivos</h2>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {isStagedMode ? (
                <button
                  type="button"
                  disabled={
                    isSavingPending ||
                    uploadMutation.isPending ||
                    (!pendingFiles.length && !Object.keys(pendingReplaces).length)
                  }
                  onClick={() => void savePendingFiles()}
                  title="Sube documentos nuevos y aplica los reemplazos en cola en la base de datos"
                  className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSavingPending || uploadMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {isSavingPending || uploadMutation.isPending ? 'Guardando…' : 'Guardar archivos'}
                </button>
              ) : null}
              {canUseGlobalSave ? (
                <button
                  type="button"
                  disabled={!hasPendingToSave || saveAllPendingMutation.isPending}
                  onClick={() => void saveAllPendingMutation.mutateAsync()}
                  title="Solo guarda comentarios y documentos firmados pendientes (PDF o Word); no aprueba el trámite"
                  className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                >
                  {saveAllPendingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Guardar
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="p-2 sm:p-3">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              Error al cargar archivos
            </div>
          ) : list.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">
              {canUpload
                ? 'Aún no hay archivos. Use el área superior para agregar documentos.'
                : 'No hay archivos en este trámite.'}
            </div>
          ) : (
            <>
              <ul className="divide-y divide-gray-100">
              {list.map((file) => {
                if (file.isFinal && file.isSigned) return null;
                const canPreview = getPreviewKind(file) !== 'none';
                const rowComments = [...(commentsByFile.get(file.id) ?? [])].sort(
                  (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );
                const perArea = lastCommentByFileArea.get(file.id);
                const hasCommentsByArea = perArea && perArea.size > 0;
                const toSign = (filesToSign || []).find((f) => f.fileId === file.id);
                const signedPairFile = signedBySourceId.get(file.id) as FileData | undefined;
                const signedDraft = signedDraftBySource[file.id];
                const signerArea = signerAreaByFile[file.id] || toSign?.requiredByArea || 'DIRECTOR_GENERAL';
                /** Quién firma según el desplegable (incluye borrador): define si se muestra el área de subida. */
                const canUploadSignedNow = !!(
                  toSign &&
                  !toSign.isSigned &&
                  ((signerArea === 'LEGAL' && canUploadSignedAsLegal) ||
                    (signerArea === 'DIRECTOR_GENERAL' && canUploadSignedAsDirector))
                );
                return (
                  <li key={file.id} className="px-2 py-3 sm:px-3">
                    <div className={`grid grid-cols-1 gap-3 ${canViewSignedFiles ? 'sm:grid-cols-2' : ''}`}>
                      <div className="rounded-md border border-gray-200 bg-white p-3">
                        <p className="text-[11px] font-semibold uppercase text-gray-500">Archivo base</p>
                        <div className="mt-1 flex min-w-0 items-start gap-3">
                          <div className="flex-shrink-0 pt-0.5">{getFileIcon(file.fileType)}</div>
                          <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="break-words text-sm font-medium text-gray-900">{file.fileName}</span>
                            {file.version > 1 ? (
                              <span className="inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                                v{file.version}
                              </span>
                            ) : null}
                            {file.isCreationUpload ? (
                              <span
                                className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900"
                                title="Documento inicial del trámite: no se puede eliminar"
                              >
                                <Lock className="h-3 w-3" />
                                Inicial
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <span>{formatFileSize(file.fileSize)}</span>
                            <span className="hidden sm:inline">•</span>
                            <span className="truncate">{file.uploadedByName}</span>
                            <span className="hidden sm:inline">•</span>
                            <span>
                              {format(new Date(file.createdAt), "d 'de' MMM, yyyy", { locale: es })}
                            </span>
                          </div>

                          {perArea && perArea.size > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {Array.from(perArea.entries()).map(([area]) => {
                                const label = labelForCommentArea(area);
                                return (
                                  <span
                                    key={`${file.id}-${area}`}
                                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-800"
                                    title={`Comentario en el archivo (${label}). No indica aprobación del flujo.`}
                                  >
                                    <span className="font-semibold">{label}</span>
                                    <span>· Comentario</span>
                                  </span>
                                );
                              })}
                            </div>
                          ) : null}

                          {rowComments.length > 0 ? (
                            <div className="mt-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setCommentsOpenByFile((prev) => ({
                                    ...prev,
                                    [file.id]: !prev[file.id],
                                  }))
                                }
                                className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900"
                              >
                                {commentsOpenByFile[file.id] ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                Ver comentarios ({rowComments.length})
                              </button>
                              {commentsOpenByFile[file.id] ? (
                                <div className="mt-2 space-y-2 rounded-md border border-gray-100 bg-gray-50/80 p-2">
                                  <p className="text-xs font-medium text-gray-600">Comentarios por área</p>
                                  {rowComments.map((c) => (
                                    <div key={c.id} className="text-xs text-gray-800">
                                      {c.userArea ? (
                                        <span className="mr-1.5 inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                                          {labelForCommentArea(c.userArea)}
                                        </span>
                                      ) : null}
                                      <span className="font-medium text-gray-900">{c.authorName}</span>
                                      <span className="text-gray-500">
                                        {' '}
                                        · {format(new Date(c.createdAt), "d MMM yyyy, HH:mm", { locale: es })}
                                      </span>
                                      <p className="mt-0.5 whitespace-pre-wrap">{c.content}</p>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          {canCommentFile ? (
                            <div className="mt-3 min-w-0 flex-1">
                              <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600">
                                <MessageSquare className="h-3.5 w-3.5" />
                                Comentario sobre este archivo
                              </label>
                              <textarea
                                value={commentDrafts[file.id] ?? ''}
                                onChange={(e) =>
                                  setCommentDrafts((d) => ({ ...d, [file.id]: e.target.value }))
                                }
                                rows={2}
                                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Indique observaciones sobre este documento…"
                              />
                            </div>
                          ) : null}
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-end gap-1">
                          {canPreview ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openPreviewView(file)}
                                className="rounded-md p-1.5 text-gray-600 hover:bg-slate-100 hover:text-slate-800"
                                title="Ver documento (solo lectura)"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              {canAnnotateReviewRow(file, caseStatus, canCommentFile) ? (
                                <button
                                  type="button"
                                  onClick={() => void openPreviewAnnotate(file)}
                                  className="rounded-md p-1.5 text-gray-600 hover:bg-violet-50 hover:text-violet-700"
                                  title={
                                    getPreviewKind(file) === 'word'
                                      ? 'Revisar Word: descargar, editar y subir la versión corregida. Si otra área está editando, espere.'
                                      : 'Anotar PDF. Si otra área está anotando, solo lectura hasta que terminen.'
                                  }
                                >
                                  <Pen className="h-4 w-4" />
                                </button>
                              ) : null}
                            </>
                          ) : null}
                          {canDownloadFiles ? (
                            <button
                              type="button"
                              onClick={() => handleDownload(file)}
                              className="rounded-md p-1.5 text-gray-600 hover:bg-blue-50 hover:text-blue-600"
                              title="Descargar base"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          ) : null}
                          {canReplaceReturnedFiles && !signedPairFile ? (
                            <button
                              type="button"
                              disabled={
                                isSavingPending ||
                                uploadMutation.isPending ||
                                (!isStagedMode && replaceMutation.isPending)
                              }
                              onClick={() => {
                                replaceTargetIdRef.current = file.id;
                                replaceInputRef.current?.click();
                              }}
                              className={`rounded-md p-1.5 disabled:opacity-50 ${
                                pendingReplaces[file.id] ||
                                (!isStagedMode &&
                                  replaceMutation.isPending &&
                                  replaceMutation.variables?.fileId === file.id)
                                  ? 'text-amber-700 ring-1 ring-amber-300 bg-amber-50'
                                  : 'text-gray-600 hover:bg-amber-50 hover:text-amber-700'
                              }`}
                              title={
                                pendingReplaces[file.id]
                                  ? 'Hay un reemplazo en cola — pulse Guardar archivos arriba'
                                  : !isStagedMode &&
                                      replaceMutation.isPending &&
                                      replaceMutation.variables?.fileId === file.id
                                    ? 'Actualizando…'
                                    : 'Elegir archivo para reemplazar (se guarda en la base al pulsar Guardar archivos)'
                              }
                            >
                              <RefreshCw
                                className={`h-4 w-4 ${
                                  !isStagedMode &&
                                  replaceMutation.isPending &&
                                  replaceMutation.variables?.fileId === file.id
                                    ? 'animate-spin'
                                    : ''
                                }`}
                              />
                            </button>
                          ) : null}
                          {canDeleteNonInitialFiles && !file.isCreationUpload && !hasCommentsByArea ? (
                            <button
                              type="button"
                              onClick={() => requestDelete(file)}
                              className="rounded-md p-1.5 text-gray-600 hover:bg-red-50 hover:text-red-600"
                              title="Eliminar archivo"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {canViewSignedFiles ? (
                        <div className="rounded-md border border-purple-200 bg-purple-50 p-3">
                          <p className="text-[11px] font-semibold uppercase text-purple-700">
                            {signedPairFile
                              ? 'Archivo firmado'
                              : canUploadSignedNow
                                ? 'Subir copia firmada'
                                : canMarkForSigning && !signedPairFile
                                  ? 'Archivo firmado'
                                  : toSign
                                    ? 'Archivo firmado'
                                    : 'Archivo firmado no disponible'}
                          </p>
                          {canMarkForSigning && !signedPairFile ? (
                            <div className="mt-2 rounded-md border border-purple-200 bg-white p-2">
                              <p className="text-[11px] font-semibold text-purple-800">Definir firma</p>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <select
                                  value={signerArea}
                                  disabled={saveAllPendingMutation.isPending}
                                  onChange={(e) => {
                                    const v = e.target.value as 'LEGAL' | 'DIRECTOR_GENERAL';
                                    setSignerAreaByFile((prev) => ({
                                      ...prev,
                                      [file.id]: v,
                                    }));
                                    if (v === 'DIRECTOR_GENERAL') {
                                      setSignedDraftBySource((prev) => ({ ...prev, [file.id]: undefined }));
                                    }
                                  }}
                                  className="min-w-0 flex-1 rounded-md border border-purple-300 px-2 py-1 text-xs text-purple-900 disabled:opacity-60 sm:min-w-[12rem] sm:flex-none"
                                >
                                  <option value="LEGAL">Firma área legal</option>
                                  <option value="DIRECTOR_GENERAL">Firma Director General</option>
                                </select>
                              </div>
                            </div>
                          ) : null}
                          {signedPairFile ? (
                            <div className="mt-2 rounded-md border border-emerald-300 bg-emerald-50/90 px-3 py-2.5 shadow-sm">
                              <p className="truncate text-sm font-medium text-emerald-950">{signedPairFile.fileName}</p>
                              <p className="mt-1 text-xs font-medium text-emerald-800">Firmado y cargado</p>
                              <div className="mt-2 flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => openPreviewView(signedPairFile)}
                                  className="rounded-md p-1.5 text-emerald-900/80 hover:bg-white hover:text-blue-600"
                                  title="Visualizar firmado"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                {canDownloadSignedFiles ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDownload(signedPairFile)}
                                    className="rounded-md p-1.5 text-emerald-900/80 hover:bg-white hover:text-blue-600"
                                    title="Descargar firmado"
                                  >
                                    <Download className="h-4 w-4" />
                                  </button>
                                ) : null}
                                {canDeleteSignedAsDirector || canDeleteSignedAsLegal ? (
                                  <button
                                    type="button"
                                    onClick={() => requestDelete(signedPairFile)}
                                    className="rounded-md p-1.5 text-emerald-900/80 hover:bg-red-50 hover:text-red-600"
                                    title="Eliminar firmado"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          ) : canUploadSignedNow ? (
                            <div
                              className="mt-2 rounded-md border-2 border-dashed border-purple-300 bg-white px-3 py-3"
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const f = e.dataTransfer.files?.[0];
                                if (!f || !isAllowedSignedDocumentFileName(f.name)) {
                                  showError('Solo se permiten copias firmadas en PDF o Word (.doc, .docx)');
                                  return;
                                }
                                setSignedDraftBySource((prev) => ({ ...prev, [file.id]: f }));
                              }}
                            >
                              <input
                                id={`signed-input-${file.id}`}
                                type="file"
                                className="hidden"
                                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (!f) return;
                                  if (!isAllowedSignedDocumentFileName(f.name)) {
                                    showError('Solo se permiten copias firmadas en PDF o Word (.doc, .docx)');
                                    e.target.value = '';
                                    return;
                                  }
                                  setSignedDraftBySource((prev) => ({ ...prev, [file.id]: f }));
                                  e.target.value = '';
                                }}
                              />
                              <label
                                htmlFor={`signed-input-${file.id}`}
                                className="flex cursor-pointer flex-col items-center justify-center py-2 text-center text-xs text-purple-800 hover:text-purple-900"
                              >
                                Arrastre aquí la copia firmada (PDF o Word)
                                <span className="mt-1 text-[11px] text-purple-700">o clic para elegir archivo (.pdf, .doc, .docx)</span>
                              </label>
                              {signedDraft ? (
                                <PendingSignedDraftPreview
                                  draft={signedDraft}
                                  onRemove={() =>
                                    setSignedDraftBySource((prev) => ({ ...prev, [file.id]: undefined }))
                                  }
                                />
                              ) : null}
                            </div>
                          ) : toSign ? (
                            <p className="mt-2 text-xs text-purple-800">
                              {signerArea === 'LEGAL'
                                ? 'Pendiente de firma del área Legal'
                                : 'Pendiente de firma del Director General'}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
              </ul>
            </>
          )}
        </div>
      </div>

      {previewFile && previewSrc && previewKind !== 'none' ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="file-preview-title"
          onClick={closePreview}
        >
          {showPdfAnnotator ? (
            <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
              <PdfAnnotatorViewer
                pdfUrl={previewSrc}
                fileId={previewFile.id}
                fileName={previewFile.fileName}
                useAnnotationLock={useAnnotationLock}
                onSavingChange={setAnnotatorSaving}
                onClose={closePreview}
                onSaved={() => {
                  queryClient.invalidateQueries({ queryKey: ['files', caseId] });
                  queryClient.invalidateQueries({ queryKey: ['case', caseId] });
                  queryClient.invalidateQueries({ queryKey: ['case-history', caseId] });
                  showSuccess('Anotaciones guardadas. Al volver a abrir el archivo verá el PDF actualizado.');
                }}
              />
            </div>
          ) : showDocxReviewPanel ? (
            <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
              <DocxReviewReplacePanel
                documentUrl={previewSrc}
                fileId={previewFile.id}
                fileName={previewFile.fileName}
                useAnnotationLock={useAnnotationLock}
                onSavingChange={setAnnotatorSaving}
                onClose={closePreview}
                onSaved={() => {
                  queryClient.invalidateQueries({ queryKey: ['files', caseId] });
                  queryClient.invalidateQueries({ queryKey: ['case', caseId] });
                  queryClient.invalidateQueries({ queryKey: ['case-history', caseId] });
                  showSuccess('Documento actualizado. La nueva versión queda registrada en el trámite.');
                }}
              />
            </div>
          ) : (
            <div
              className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 sm:px-5">
                <h3
                  id="file-preview-title"
                  className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 sm:text-base"
                >
                  {previewFile.fileName}
                </h3>
                <div className="flex flex-shrink-0 items-center gap-1">
                  {(canDeleteNonInitialFiles && !previewFile.isCreationUpload && !previewFile.isSigned) ||
                  (previewFile.isSigned && (canDeleteSignedAsDirector || canDeleteSignedAsLegal)) ? (
                    <button
                      type="button"
                      onClick={() => requestDelete(previewFile)}
                      className="rounded-md p-2 text-gray-600 hover:bg-red-50 hover:text-red-600"
                      title="Eliminar archivo"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  ) : null}
                  {previewFile.isCreationUpload ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-amber-800"
                      title="Documento inicial: no se puede eliminar"
                    >
                      <Lock className="h-4 w-4" />
                      Inicial
                    </span>
                  ) : null}
                  {(previewFile.isSigned ? canDownloadSignedFiles : canDownloadFiles) ? (
                    <button
                      type="button"
                      onClick={() => handleDownload(previewFile)}
                      className="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-blue-600"
                      title="Descargar"
                    >
                      <Download className="h-5 w-5" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={closePreview}
                    className="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    title="Cerrar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto bg-gray-100 p-2 sm:p-4">
                {previewKind === 'pdf' ? (
                  <iframe
                    title={previewFile.fileName}
                    src={previewSrc}
                    className="h-[75vh] max-h-[720px] w-full min-h-[400px] rounded-md border border-gray-200 bg-white"
                  />
                ) : null}
                {previewKind === 'image' ? (
                  <div className="flex min-h-[400px] h-[75vh] max-h-[720px] items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewSrc}
                      alt={previewFile.fileName}
                      className="max-h-[75vh] w-auto max-w-full rounded-md border border-gray-200 bg-white object-contain shadow-sm"
                    />
                  </div>
                ) : null}
                {previewKind === 'text' ? (
                  <iframe
                    title={previewFile.fileName}
                    src={previewSrc}
                    className="h-[60vh] max-h-[560px] w-full min-h-[280px] rounded-md border border-gray-200 bg-white font-mono text-sm"
                  />
                ) : null}
                {previewKind === 'word' ? (
                  <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-md border border-gray-200 bg-white px-6 py-10 text-center">
                    <FileText className="h-12 w-12 text-violet-500" aria-hidden />
                    <div className="max-w-md space-y-2 text-sm text-gray-700">
                      <p className="font-medium text-gray-900">Vista previa no disponible en el navegador</p>
                      <p>
                        Descargue el documento para abrirlo en Word. Si tiene permiso de revisión, use el ícono del lápiz
                        en la lista para subir la versión corregida.
                      </p>
                    </div>
                    {(previewFile.isSigned ? canDownloadSignedFiles : canDownloadFiles) ? (
                      <button
                        type="button"
                        onClick={() => handleDownload(previewFile)}
                        className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
                      >
                        <Download className="h-4 w-4" aria-hidden />
                        Descargar
                      </button>
                    ) : (
                      <p className="text-xs text-gray-500">Su perfil no incluye descarga; solicite el archivo al administrador.</p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {isSavingPending || (!isStagedMode && replaceMutation.isPending) ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          role="alertdialog"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="rounded-lg bg-white px-6 py-5 shadow-xl">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-600" />
            <p className="mt-4 text-center text-sm font-medium text-gray-900">
              {isSavingPending
                ? 'Guardando y actualizando archivos…'
                : 'Actualizando archivos…'}
            </p>
          </div>
        </div>
      ) : null}

      {toasts.map((toast, i) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          zIndex={200 + i}
          onClose={() => hideToast(toast.id)}
        />
      ))}

    </>
  );
}
