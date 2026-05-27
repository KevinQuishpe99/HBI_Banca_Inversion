'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  User,
  FileText,
  Building2,
  Clock,
  AlertCircle,
  Banknote,
  Link2,
  PenLine,
  LayoutTemplate,
  FileType2,
  Route,
} from 'lucide-react';
import { Case } from '@/types/case.types';
import { formatCaseNumber } from '@/lib/utils/format';

interface CaseInformationProps {
  caseData: Case;
}

type CatalogRow = { code: string; label: string };

function buildLabelMap(rows: CatalogRow[]): Record<string, string> {
  return Object.fromEntries(rows.map((x) => [x.code, x.label || x.code]));
}

export function CaseInformation({ caseData }: CaseInformationProps) {
  const [docLabels, setDocLabels] = useState<Record<string, string>>({});
  const [sigLabels, setSigLabels] = useState<Record<string, string>>({});
  const [tplLabels, setTplLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [dRes, sRes, tRes] = await Promise.all([
          fetch('/api/meta/document-types'),
          fetch('/api/meta/signature-types'),
          fetch('/api/meta/template-types'),
        ]);
        const [dJson, sJson, tJson] = await Promise.all([dRes.json(), sRes.json(), tRes.json()]);
        if (cancelled) return;
        setDocLabels(buildLabelMap(Array.isArray(dJson?.data) ? dJson.data : []));
        setSigLabels(buildLabelMap(Array.isArray(sJson?.data) ? sJson.data : []));
        setTplLabels(buildLabelMap(Array.isArray(tJson?.data) ? tJson.data : []));
      } catch {
        /* catálogos opcionales para etiquetas */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const formatDate = (date?: Date | string) => {
    if (!date) return 'No especificada';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const catalogLabel = (map: Record<string, string>, code?: string | null) => {
    if (code == null || String(code).trim() === '') return '—';
    return map[code] ?? code;
  };

  const formatAmountUsd = (value: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(
      value
    );

  const montoBloque = () => {
    if (caseData.amountApplies === true) {
      if (caseData.amountValue != null && Number.isFinite(Number(caseData.amountValue))) {
        return formatAmountUsd(Number(caseData.amountValue));
      }
      return 'Sí aplica, sin monto numérico registrado';
    }
    if (caseData.amountApplies === false) {
      return 'No aplica monto';
    }
    return '—';
  };

  const routingFlowLabel =
    caseData.routingFlow === 'SUPERVISION_CHAIN'
      ? 'Cadena con supervisión de áreas'
      : caseData.routingFlow === 'DIRECT_LEGAL'
        ? 'Revisión directa (sin paso de supervisión previo)'
        : null;

  const sharepoint = caseData.sharepointUrl?.trim();
  const sharepointSafe =
    sharepoint && (sharepoint.startsWith('http://') || sharepoint.startsWith('https://')) ? sharepoint : null;

  const showDetalleSolicitud =
    !!caseData.documentType ||
    caseData.amountApplies != null ||
    !!caseData.signatureType ||
    !!caseData.templateType ||
    !!sharepointSafe;

  return (
    <div className="space-y-6">
      {/* Información General */}
      <div className="rounded-lg bg-gray-50 p-4 sm:p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
          <FileText className="h-5 w-5 text-blue-600" />
          Información General
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Número de trámite</label>
            <p className="text-sm font-medium text-gray-900">{formatCaseNumber(caseData.caseNumber)}</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Título del trámite (Resumen)</label>
            <p className="text-sm font-medium text-gray-900">{caseData.title}</p>
          </div>
          {caseData.advisorName ? (
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-500">
                <User className="h-3 w-3" />
                1. Asesor comercial o responsable
              </label>
              <p className="text-sm font-medium text-gray-900">{caseData.advisorName}</p>
            </div>
          ) : null}
          {caseData.documentFileName ? (
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-500">
                2. Archivo(s) de la solicitud (referencia)
              </label>
              <p className="whitespace-pre-wrap text-sm text-gray-900">{caseData.documentFileName}</p>
            </div>
          ) : null}
          {caseData.odooCode ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">3. # Odoo</label>
              <p className="text-sm font-medium text-gray-900">{caseData.odooCode}</p>
            </div>
          ) : null}
          {caseData.clientProvider ? (
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-500">
                <Building2 className="h-3 w-3" />
                4. Cliente / Proveedor
              </label>
              <p className="text-sm font-medium text-gray-900">{caseData.clientProvider}</p>
            </div>
          ) : null}
          {caseData.description ? (
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-500">Descripción</label>
              <p className="text-sm text-gray-900">{caseData.description}</p>
            </div>
          ) : null}
          {!showDetalleSolicitud ? (
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-500">
                <Banknote className="h-3 w-3" />
                6. Monto
              </label>
              <p className="text-sm font-medium text-gray-900">{montoBloque()}</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Documento, monto y catálogos */}
      {showDetalleSolicitud ? (
        <div className="rounded-lg bg-gray-50 p-4 sm:p-6">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
            <FileType2 className="h-5 w-5 text-indigo-600" />
            Documento y condiciones de la solicitud
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {caseData.documentType ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">5. Tipo de documento</label>
                <p className="text-sm font-medium text-gray-900">
                  {catalogLabel(docLabels, caseData.documentType)}
                </p>
              </div>
            ) : null}
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-500">
                <Banknote className="h-3 w-3" />
                6. Monto
              </label>
              <p className="text-sm font-medium text-gray-900">{montoBloque()}</p>
            </div>
            {caseData.signatureType ? (
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-500">
                  <PenLine className="h-3 w-3" />
                  10. Tipo de firma
                </label>
                <p className="text-sm font-medium text-gray-900">
                  {catalogLabel(sigLabels, caseData.signatureType)}
                </p>
              </div>
            ) : null}
            {caseData.templateType ? (
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-500">
                  <LayoutTemplate className="h-3 w-3" />
                  11. Tipo de plantilla
                </label>
                <p className="text-sm font-medium text-gray-900">
                  {catalogLabel(tplLabels, caseData.templateType)}
                </p>
              </div>
            ) : null}
            {sharepointSafe ? (
              <div className="md:col-span-2">
                <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-500">
                  <Link2 className="h-3 w-3" />
                  Enlace SharePoint
                </label>
                <Link
                  href={sharepointSafe}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900"
                >
                  {sharepointSafe}
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Fechas y Plazos */}
      {(caseData.requestDate ||
        caseData.requiredDeliveryDate ||
        caseData.dueDate ||
        caseData.urgencyJustification) && (
        <div className="rounded-lg bg-gray-50 p-4 sm:p-6">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Calendar className="h-5 w-5 text-green-600" />
            Fechas y Plazos
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {caseData.requestDate ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">7. Fecha de solicitud</label>
                <p className="text-sm font-medium text-gray-900">{formatDate(caseData.requestDate)}</p>
              </div>
            ) : null}
            {caseData.requiredDeliveryDate ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">8. Fecha de entrega requerida</label>
                <p className="text-sm font-medium text-gray-900">{formatDate(caseData.requiredDeliveryDate)}</p>
              </div>
            ) : null}
            {caseData.dueDate ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Fecha límite</label>
                <p className="text-sm font-medium text-gray-900">{formatDate(caseData.dueDate)}</p>
              </div>
            ) : null}
            {caseData.urgencyJustification ? (
              <div className="md:col-span-2">
                <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-500">
                  <AlertCircle className="h-3 w-3 text-orange-500" />
                  9. Justificación de urgencia
                </label>
                <p className="rounded border border-orange-200 bg-orange-50 p-3 text-sm text-gray-900">
                  {caseData.urgencyJustification}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Observaciones */}
      {caseData.observations ? (
        <div className="rounded-lg bg-gray-50 p-4 sm:p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">12. Observaciones</h3>
          <p className="whitespace-pre-wrap text-sm text-gray-900">{caseData.observations}</p>
        </div>
      ) : null}

      {/* Información del Sistema */}
      <div className="rounded-lg bg-gray-50 p-4 sm:p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Clock className="h-5 w-5 text-gray-600" />
          Información del Sistema
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {routingFlowLabel ? (
            <div className="md:col-span-2">
              <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-500">
                <Route className="h-3 w-3" />
                Tipo de flujo de enrutamiento
              </label>
              <p className="text-sm font-medium text-gray-900">{routingFlowLabel}</p>
            </div>
          ) : null}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Fecha de creación</label>
            <p className="text-sm font-medium text-gray-900">{formatDate(caseData.createdAt)}</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Última actualización</label>
            <p className="text-sm font-medium text-gray-900">{formatDate(caseData.updatedAt)}</p>
          </div>
          {caseData.completedAt ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Fecha de completado</label>
              <p className="text-sm font-medium text-gray-900">{formatDate(caseData.completedAt)}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
