'use client';

import { useRef, useState } from 'react';
import { Loader2, Upload, FileText } from 'lucide-react';
import { useHbiDocumentos, useSubirDocumentoHbi } from '@/hooks/useHbiOperaciones';
import type { TipoDocumentoContractual } from '@/types/hbi/operacion.types';

const TIPOS_DOC: TipoDocumentoContractual[] = [
  'CONTRATO_MARCO',
  'ANEXO_1',
  'ANEXO_2',
  'ANEXO_3',
  'CRONOGRAMA',
  'GARANTIA',
  'OTRO',
];

type Props = { operacionId: string };

export function Fase1DocumentosPanel({ operacionId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tipoManual, setTipoManual] = useState<TipoDocumentoContractual | ''>('');
  const { data: docs, isLoading } = useHbiDocumentos(operacionId);
  const subir = useSubirDocumentoHbi(operacionId);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', file);
      if (tipoManual) fd.append('tipoDocumento', tipoManual);
      await subir.mutateAsync(fd);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="font-semibold text-slate-900">Fase 1 — Paquete contractual del crédito</h3>
        <p className="mt-1 text-sm text-slate-600">
          Cargue la base contractual completa. El sistema clasifica Anexos 1, 2 y 3 y extrae datos clave del nombre.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600">Clasificación manual (opcional)</label>
          <select
            value={tipoManual}
            onChange={(e) => setTipoManual(e.target.value as TipoDocumentoContractual | '')}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Automática por nombre</option>
            {TIPOS_DOC.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={subir.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {subir.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Subir documentos
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
          {docs?.length === 0 ? (
            <li className="p-4 text-sm text-slate-500">Sin documentos en este paquete de crédito.</li>
          ) : (
            docs?.map((d) => (
              <li key={d.id} className="flex items-start gap-3 p-3 text-sm">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{d.nombreArchivo}</p>
                  <p className="text-xs text-slate-500">
                    {d.tipoDocumento}
                    {typeof d.datosExtraidos?.posibleMonto === 'string'
                      ? ` · Monto detectado: ${d.datosExtraidos.posibleMonto}`
                      : ''}
                  </p>
                  {typeof d.datosExtraidos?.hashContenido === 'string' ? (
                    <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                      {d.datosExtraidos.hashContenido}
                      {typeof d.datosExtraidos.subidoPor === 'string'
                        ? ` · ${d.datosExtraidos.subidoPor}`
                        : ''}
                    </p>
                  ) : null}
                </div>
                {d.blobUrl ? (
                  <a
                    href={d.blobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs text-blue-700 hover:underline"
                  >
                    Ver
                  </a>
                ) : null}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
