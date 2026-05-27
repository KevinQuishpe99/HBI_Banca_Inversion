'use client';

import { useEffect } from 'react';
import { Download, ExternalLink, FileText, X } from 'lucide-react';
import {
  tipoVistaPreviaDocumento,
  urlVistaPreviaDocumento,
} from '@/lib/hbi/documento-preview';
import type { DocumentoContractual } from '@/types/hbi/operacion.types';

type Props = {
  documento: DocumentoContractual | null;
  onCerrar: () => void;
};

export function VisorDocumentoModal({ documento, onCerrar }: Props) {
  useEffect(() => {
    if (!documento) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [documento, onCerrar]);

  if (!documento) return null;

  const url = urlVistaPreviaDocumento(documento);
  const tipo = tipoVistaPreviaDocumento(documento);
  const tamano =
    typeof documento.tamanoBytes === 'number'
      ? `${(documento.tamanoBytes / 1024).toFixed(1)} KB`
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="visor-doc-titulo"
      onClick={onCerrar}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex min-w-0 items-start gap-2">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div className="min-w-0">
              <h2 id="visor-doc-titulo" className="truncate font-semibold text-slate-900">
                {documento.nombreArchivo}
              </h2>
              <p className="text-xs text-slate-500">
                {documento.tipoDocumento}
                {tamano ? ` · ${tamano}` : ''}
                {documento.mimeType ? ` · ${documento.mimeType}` : ''}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Nueva pestaña
            </a>
            <a
              href={url}
              download={documento.nombreArchivo}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" />
              Descargar
            </a>
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Cerrar visor"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="min-h-[50vh] flex-1 overflow-auto bg-slate-100 p-2">
          {tipo === 'imagen' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={documento.nombreArchivo}
              className="mx-auto max-h-[70vh] max-w-full rounded-lg object-contain shadow"
            />
          ) : tipo === 'pdf' ? (
            <iframe
              title={documento.nombreArchivo}
              src={url}
              className="h-[70vh] w-full rounded-lg border-0 bg-white shadow"
            />
          ) : (
            <iframe
              title={documento.nombreArchivo}
              src={url}
              className="h-[70vh] w-full rounded-lg border-0 bg-white shadow"
            />
          )}
        </div>
      </div>
    </div>
  );
}
