'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { Loader2, FileUp, Download, X } from 'lucide-react';
import { MAX_FILE_SIZE } from '@/lib/validations/file.schema';

type Props = {
  documentUrl: string;
  fileId: string;
  fileName: string;
  onClose: () => void;
  onSaved: () => void;
  /** Heartbeat del bloqueo de anotación (mismo criterio que PDF). */
  useAnnotationLock?: boolean;
  onSavingChange?: (saving: boolean) => void;
};

function esWordMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return (
    m === 'application/msword' ||
    m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

function esWordNombre(nombre: string): boolean {
  const n = nombre.toLowerCase();
  return n.endsWith('.doc') || n.endsWith('.docx');
}

export function DocxReviewReplacePanel({
  documentUrl,
  fileId,
  fileName,
  onClose,
  onSaved,
  useAnnotationLock = true,
  onSavingChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [elegido, setElegido] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onSavingChange?.(guardando);
  }, [guardando, onSavingChange]);

  useEffect(() => {
    if (!useAnnotationLock) return;
    const latido = () => {
      void fetch(`/api/files/${fileId}/annotation-lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'heartbeat' }),
        credentials: 'include',
      }).catch(() => {});
    };
    latido();
    const intervalo = window.setInterval(latido, 15_000);
    return () => {
      window.clearInterval(intervalo);
      void fetch(`/api/files/${fileId}/annotation-lock`, { method: 'DELETE', credentials: 'include' }).catch(
        () => {},
      );
    };
  }, [fileId, useAnnotationLock]);

  const alElegirArchivo = useCallback((lista: FileList | null) => {
    setError(null);
    const f = lista?.[0];
    if (!f) {
      setElegido(null);
      return;
    }
    if (!esWordMime(f.type) && !esWordNombre(f.name)) {
      setError('Seleccione un archivo .doc o .docx.');
      setElegido(null);
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError(`El archivo supera el máximo de ${MAX_FILE_SIZE / (1024 * 1024)} MB.`);
      setElegido(null);
      return;
    }
    setElegido(f);
  }, []);

  const enviarRevision = useCallback(async () => {
    if (!elegido) return;
    setError(null);
    setGuardando(true);
    try {
      const form = new FormData();
      form.append('file', elegido);
      const res = await fetch(`/api/files/${fileId}/review-annotate`, {
        method: 'POST',
        body: form,
        credentials: 'include',
      });
      const j = await res.json().catch(() => ({} as { error?: string; details?: { message?: string } }));
      if (!res.ok) {
        let msg = j?.error || 'No se pudo guardar';
        if (process.env.NODE_ENV === 'development' && j?.details?.message) {
          msg = `${msg} (${j.details.message})`;
        }
        throw new Error(msg);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }, [elegido, fileId, onClose, onSaved]);

  return (
    <>
      {guardando ? (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="docx-saving-title"
          aria-busy="true"
        >
          <div className="max-w-md rounded-xl border border-slate-200/90 bg-white px-8 py-10 text-center shadow-2xl ring-1 ring-slate-900/10">
            <Loader2 className="mx-auto h-11 w-11 animate-spin text-slate-700" aria-hidden />
            <p id="docx-saving-title" className="mt-5 text-lg font-semibold text-slate-900">
              Guardando documento
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Por favor espere. No cierre esta ventana hasta que termine.
            </p>
          </div>
        </div>
      ) : null}
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xl ring-1 ring-slate-900/5">
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-slate-900">Revisión Word</h2>
            <p className="truncate text-xs text-slate-600">{fileName}</p>
          </div>
          <button
            type="button"
            disabled={guardando}
            onClick={onClose}
            className="rounded-md p-2 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900 disabled:opacity-50"
            title="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto p-4 text-sm text-slate-700">
          <p className="leading-relaxed">
            Descargue el documento, ábralo en Microsoft Word (o compatible), aplique comentarios o cambios, guarde y
            suba aquí el archivo. Se reemplaza la versión en el trámite conservando el mismo registro de archivo.
          </p>
          <a
            href={`${documentUrl}?download=1`}
            download={fileName}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden />
            Descargar documento actual
          </a>
          <div>
            <input
              ref={inputRef}
              type="file"
              accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => {
                alElegirArchivo(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={guardando}
              onClick={() => inputRef.current?.click()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm font-medium text-violet-900 hover:bg-violet-100/80 disabled:opacity-50"
            >
              <FileUp className="h-4 w-4 shrink-0" aria-hidden />
              Elegir .doc / .docx revisado
            </button>
            {elegido ? (
              <p className="mt-2 truncate text-xs text-slate-600" title={elegido.name}>
                Seleccionado: <span className="font-medium text-slate-800">{elegido.name}</span> (
                {(elegido.size / 1024).toFixed(1)} KB)
              </p>
            ) : null}
          </div>
          {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
        </div>
        <div className="flex flex-shrink-0 justify-end gap-2 border-t border-slate-200 bg-slate-50/90 px-4 py-3">
          <button
            type="button"
            disabled={guardando}
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200/60 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={guardando || !elegido}
            onClick={() => void enviarRevision()}
            className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Guardar revisión
          </button>
        </div>
      </div>
    </>
  );
}
