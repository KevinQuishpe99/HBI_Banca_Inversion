'use client';

import { useEffect, useState } from 'react';
import type { Case } from '@/types/case.types';
import { FileText, FileSignature } from 'lucide-react';

type Props = {
  caseData: Case;
};

/**
 * Metadatos de documentos y firma (pestaña Archivos del trámite).
 */
export function CaseDocumentsInfo({ caseData }: Props) {
  const [docLabelByCode, setDocLabelByCode] = useState<Record<string, string>>({});
  const [sigLabelByCode, setSigLabelByCode] = useState<Record<string, string>>({});
  const [tplLabelByCode, setTplLabelByCode] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [docRes, sigRes, tplRes] = await Promise.all([
          fetch('/api/meta/document-types'),
          fetch('/api/meta/signature-types'),
          fetch('/api/meta/template-types'),
        ]);
        const [docJson, sigJson, tplJson] = await Promise.all([docRes.json(), sigRes.json(), tplRes.json()]);
        if (cancelled) return;
        const toMap = (arr: unknown[]) =>
          (Array.isArray(arr) ? arr : []).reduce<Record<string, string>>((acc, it) => {
            const o = it as Record<string, unknown>;
            if (o?.code != null && o?.label != null) acc[String(o.code)] = String(o.label);
            return acc;
          }, {});
        setDocLabelByCode(toMap(docJson?.data));
        setSigLabelByCode(toMap(sigJson?.data));
        setTplLabelByCode(toMap(tplJson?.data));
      } catch {
        // ignorar
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasDocMeta =
    !!caseData.odooCode ||
    !!caseData.documentType ||
    !!caseData.signatureType ||
    !!caseData.templateType;

  return (
    <div className="mb-4 space-y-3">
      <p className="text-sm text-gray-600">
        Aquí se muestran los datos del documento y los archivos. Los subidos al crear el trámite aparecen como{' '}
        <span className="font-medium text-gray-800">Inicial</span> y no se pueden eliminar; puede agregar más archivos
        cuando tenga permiso.
      </p>

      {!hasDocMeta ? null : (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
      <h4 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-900">
        <FileText className="h-5 w-5 text-blue-600" />
        Datos del documento
      </h4>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        {caseData.odooCode ? (
          <div>
            <span className="block text-xs font-medium text-gray-500">Código Odoo</span>
            <p className="mt-0.5 inline-block rounded border border-gray-200 bg-white px-2 py-1 font-mono text-sm text-gray-900">
              {caseData.odooCode}
            </p>
          </div>
        ) : null}
        {caseData.documentType ? (
          <div>
            <span className="block text-xs font-medium text-gray-500">Tipo de documento</span>
            <span
              className={`mt-0.5 inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                caseData.status === 'APPROVED' || caseData.status === 'COMPLETED'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {docLabelByCode[caseData.documentType] || caseData.documentType}
            </span>
          </div>
        ) : null}
        {caseData.signatureType || caseData.templateType ? (
          <div className="sm:col-span-2">
            <span className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-500">
              <FileSignature className="h-3.5 w-3.5" />
              Firma y plantilla
            </span>
            <div className="flex flex-wrap gap-2">
              {caseData.signatureType ? (
                <span className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-800">
                  Firma: {sigLabelByCode[caseData.signatureType] || caseData.signatureType}
                </span>
              ) : null}
              {caseData.templateType ? (
                <span className="inline-flex rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-800">
                  Plantilla: {tplLabelByCode[caseData.templateType] || caseData.templateType}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
      )}
    </div>
  );
}
