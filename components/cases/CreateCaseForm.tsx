'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { DocumentType, SignatureType, TemplateType } from '@/types/case.types';
import { Upload, X, FileText, Eye } from 'lucide-react';
import type { CreateCaseInput } from '@/lib/validations/case.schema';
import {
  validateCreateCaseFormBeforeSubmit,
  issuesToFieldErrors,
  issuesToSubmitErrorLines,
  focusFirstCreateCaseFieldIssue,
  zodPathToFormField,
  CREATE_CASE_FIELD_LABELS,
  type CreateCaseFormFieldIssue,
} from '@/lib/validations/create-case-form.validation';
import { showCreateCaseValidationSwal } from '@/lib/ui/create-case-validation-swal';
import {
  filterCaseCreationFiles,
  joinDocumentFileNamesForTramite,
} from '@/lib/validations/case-document-files';
import { getApiErrorMessage } from '@/lib/api/parse-api-error';
import { useActionLock } from '@/contexts/ActionLockContext';
import { buildPayloadTooLargeUserMessage } from '@/lib/upload/file-size-report';
import { Swal, escapeSwalHtml } from '@/lib/ui/swal';

export function CreateCaseForm() {
  const [title, setTitle] = useState('');
  const [description] = useState('');
  const [advisorName, setAdvisorName] = useState('');
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  /** Vista previa en modal (mismo patrón que la lista de archivos del trámite). */
  const [documentPreviewOpen, setDocumentPreviewOpen] = useState(false);
  const [indicePrevisualizar, setIndicePrevisualizar] = useState(0);
  const openPreviewAfterAdd = useRef(false);
  const [urlVistaPreviaPdf, setUrlVistaPreviaPdf] = useState<string | null>(null);
  const [odooCode, setOdooCode] = useState('');
  const [clientProvider, setClientProvider] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('');
  const [requestDate, setRequestDate] = useState('');
  const [requiredDeliveryDate, setRequiredDeliveryDate] = useState('');
  const [urgencyJustification, setUrgencyJustification] = useState('');
  const [signatureType, setSignatureType] = useState<SignatureType>('');
  const [templateType, setTemplateType] = useState<TemplateType>('');
  const [observations, setObservations] = useState('');
  /** Obligatorio: el usuario debe elegir Sí o No antes de enviar. */
  const [amountAppliesChoice, setAmountAppliesChoice] = useState<'yes' | 'no' | ''>('');
  const [amountValue, setAmountValue] = useState('');
  const [catalogsLoading, setCatalogsLoading] = useState(true);
  const [catalogsError, setCatalogsError] = useState<string | null>(null);
  const [docTypes, setDocTypes] = useState<Array<{ code: string; label: string }>>([]);
  const [sigTypes, setSigTypes] = useState<Array<{ code: string; label: string }>>([]);
  const [tplTypes, setTplTypes] = useState<Array<{ code: string; label: string }>>([]);
  const [amountAlertAreaLabels, setAmountAlertAreaLabels] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { data: session, status: sessionStatus } = useSession();
  const { isLocked, runLocked } = useActionLock();
  const formBusy = isSubmitting || isLocked;

  /** Nombre del usuario conectado como valor por defecto del asesor / responsable. */
  useEffect(() => {
    if (sessionStatus !== 'authenticated') return;
    const fullName = session?.user?.name?.trim();
    if (!fullName) return;
    setAdvisorName((prev) => (prev.trim() === '' ? fullName : prev));
  }, [sessionStatus, session?.user?.name]);

  const todayYmd = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const minDeliveryYmd = useMemo(() => {
    if (requestDate) return requestDate;
    return todayYmd;
  }, [requestDate, todayYmd]);

  useEffect(() => {
    // Preseleccionar fecha de solicitud con el día actual
    if (!requestDate) {
      setRequestDate(todayYmd);
    }

    // Fecha de entrega: por defecto igual a la solicitud (evita envío sin valor al confirmar en el modal)
    if (requestDate && !requiredDeliveryDate) {
      setRequiredDeliveryDate(requestDate);
    }

    // Si la entrega quedó antes que la solicitud, ajustarla
    if (requiredDeliveryDate && requestDate && requiredDeliveryDate < requestDate) {
      setRequiredDeliveryDate(requestDate);
    }
    // Si la solicitud quedó antes que hoy, ajustarla
    if (requestDate && requestDate < todayYmd) {
      setRequestDate(todayYmd);
    }
    // Si la entrega quedó antes que hoy, ajustarla
    if (requiredDeliveryDate && requiredDeliveryDate < todayYmd) {
      setRequiredDeliveryDate(todayYmd);
    }
  }, [requestDate, requiredDeliveryDate, todayYmd]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setCatalogsLoading(true);
        setCatalogsError(null);
        const [docRes, sigRes, tplRes, areasRes] = await Promise.all([
          fetch('/api/meta/document-types'),
          fetch('/api/meta/signature-types'),
          fetch('/api/meta/template-types'),
          fetch('/api/meta/areas'),
        ]);

        if (!docRes.ok) throw new Error('No se pudo cargar tipos de documento');
        if (!sigRes.ok) throw new Error('No se pudo cargar tipos de firma');
        if (!tplRes.ok) throw new Error('No se pudo cargar tipos de plantilla');
        if (!areasRes.ok) throw new Error('No se pudo cargar áreas');

        const [docJson, sigJson, tplJson, areasJson] = await Promise.all([
          docRes.json(),
          sigRes.json(),
          tplRes.json(),
          areasRes.json(),
        ]);
        if (cancelled) return;
        setDocTypes(Array.isArray(docJson?.data) ? docJson.data : []);
        setSigTypes(Array.isArray(sigJson?.data) ? sigJson.data : []);
        setTplTypes(Array.isArray(tplJson?.data) ? tplJson.data : []);
        const allAreas = Array.isArray(areasJson?.data) ? areasJson.data : [];
        setAmountAlertAreaLabels(
          allAreas
            .filter((a: { notifyOnHighAmount?: boolean }) => a.notifyOnHighAmount === true)
            .map((a: { label?: string; area?: string }) => a.label || a.area || '')
            .filter((v: string) => v.trim().length > 0)
        );

        setDocumentType((prev) => prev || (docJson?.data?.[0]?.code ?? ''));
        setSignatureType((prev) => prev || (sigJson?.data?.[0]?.code ?? ''));
        setTemplateType((prev) => prev || (tplJson?.data?.[0]?.code ?? ''));
      } catch (e: unknown) {
        if (!cancelled) setCatalogsError(e instanceof Error ? e.message : 'Error cargando catálogos');
      } finally {
        if (!cancelled) setCatalogsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const amountAlertAreasText = useMemo(() => {
    if (amountAlertAreaLabels.length === 0) return 'las áreas definidas por administración';
    if (amountAlertAreaLabels.length === 1) return amountAlertAreaLabels[0];
    if (amountAlertAreaLabels.length === 2) {
      return `${amountAlertAreaLabels[0]} y ${amountAlertAreaLabels[1]}`;
    }
    const head = amountAlertAreaLabels.slice(0, -1).join(', ');
    const last = amountAlertAreaLabels[amountAlertAreaLabels.length - 1];
    return `${head} y ${last}`;
  }, [amountAlertAreaLabels]);

  const appendDocumentFiles = (incoming: File[]) => {
    if (!incoming.length) return;
    setDocumentFiles((prev) => {
      const { accepted, rejected } = filterCaseCreationFiles(prev, incoming);
      if (rejected.length) {
        void Swal.fire({
          icon: 'warning',
          title: 'Archivo no válido',
          html: rejected.map((r) => `<p class="text-sm text-left">${escapeSwalHtml(r)}</p>`).join(''),
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#2563eb',
        });
      }
      if (!accepted.length) return prev;
      if (accepted.some((f) => f.name.toLowerCase().endsWith('.pdf'))) {
        openPreviewAfterAdd.current = true;
      }
      return [...prev, ...accepted];
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    appendDocumentFiles(files);
    e.target.value = '';
  };

  const handleDropFiles = (files: File[]) => {
    appendDocumentFiles(files);
  };

  // Evitar que el navegador "abra" el archivo al soltarlo fuera del dropzone
  useEffect(() => {
    const prevent = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);

  const removeFile = (index: number) => {
    setDocumentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (documentFiles.length === 0) {
      setDocumentPreviewOpen(false);
      setIndicePrevisualizar(0);
    } else if (indicePrevisualizar >= documentFiles.length) {
      setIndicePrevisualizar(Math.max(0, documentFiles.length - 1));
    }
  }, [documentFiles.length, indicePrevisualizar]);

  useEffect(() => {
    if (!openPreviewAfterAdd.current) return;
    openPreviewAfterAdd.current = false;
    if (documentFiles.length === 0) return;
    let lastPdf = -1;
    for (let i = documentFiles.length - 1; i >= 0; i--) {
      if (documentFiles[i].name.toLowerCase().endsWith('.pdf')) {
        lastPdf = i;
        break;
      }
    }
    if (lastPdf >= 0) {
      setIndicePrevisualizar(lastPdf);
      setDocumentPreviewOpen(true);
    }
  }, [documentFiles]);

  useEffect(() => {
    let objectUrl: string | null = null;
    if (documentPreviewOpen) {
      const f = documentFiles[indicePrevisualizar];
      if (f?.name.toLowerCase().endsWith('.pdf')) {
        objectUrl = URL.createObjectURL(f);
      }
    }
    setUrlVistaPreviaPdf(objectUrl);
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentPreviewOpen, indicePrevisualizar, documentFiles]);

  const closeDocumentPreview = useCallback(() => {
    setDocumentPreviewOpen(false);
  }, []);

  useEffect(() => {
    if (!documentPreviewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDocumentPreview();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [documentPreviewOpen, closeDocumentPreview]);

  const buildFormData = () => {
    const formData = new FormData();
    formData.append('title', title);
    if (description) formData.append('description', description);
    if (advisorName) formData.append('advisorName', advisorName);
    
    // Agregar todos los archivos
    documentFiles.forEach((file) => {
      formData.append('documentFiles', file);
    });
    
    // Guardar nombres de archivos separados por coma
    formData.append('documentFileName', joinDocumentFileNamesForTramite(documentFiles.map((f) => f.name)));
    
    if (odooCode) formData.append('odooCode', odooCode);
    if (clientProvider) formData.append('clientProvider', clientProvider);
    formData.append('documentType', documentType);
    const reqYmd = requestDate || todayYmd;
    const delYmd = requiredDeliveryDate || reqYmd;
    formData.append('requestDate', new Date(reqYmd + 'T12:00:00').toISOString());
    formData.append('requiredDeliveryDate', new Date(delYmd + 'T12:00:00').toISOString());
    if (urgencyJustification) formData.append('urgencyJustification', urgencyJustification);
    formData.append('signatureType', signatureType);
    formData.append('templateType', templateType);
    if (observations) formData.append('observations', observations);
    const applies = amountAppliesChoice === 'yes';
    formData.append('amountApplies', applies ? 'true' : 'false');
    if (applies && amountValue.trim() !== '') {
      formData.append('amountValue', amountValue.trim().replace(',', '.'));
    }
    return formData;
  };

  const buildPayload = (): CreateCaseInput => {
    const reqYmd = requestDate || todayYmd;
    const delYmd = requiredDeliveryDate || reqYmd;
    return {
      title: title.trim(),
      description: description ? description.trim() : undefined,
      reviewAreas: [],
      advisorName: advisorName.trim() || undefined,
      documentFileName:
        joinDocumentFileNamesForTramite(documentFiles.map((f) => f.name)) || undefined,
      odooCode: odooCode.trim() || undefined,
      clientProvider: clientProvider.trim() || undefined,
      documentType: documentType || undefined,
      sharepointUrl: undefined,
      requestDate: new Date(reqYmd + 'T12:00:00'),
      requiredDeliveryDate: new Date(delYmd + 'T12:00:00'),
      urgencyJustification: urgencyJustification ? urgencyJustification.trim() : undefined,
      signatureType: signatureType || undefined,
      templateType: templateType || undefined,
      observations: observations ? observations.trim() : undefined,
      amountApplies: amountAppliesChoice === 'yes',
      amountValue:
        amountAppliesChoice === 'yes'
          ? (() => {
              const n = parseFloat(amountValue.trim().replace(',', '.').replace(/\s/g, ''));
              return Number.isNaN(n) ? undefined : n;
            })()
          : undefined,
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validationIssues = validateCreateCaseFormBeforeSubmit({
      payload: buildPayload(),
      documentFiles,
      amountAppliesChoice,
      catalogsLoading,
      catalogsError,
    });

    if (validationIssues.length > 0) {
      setFieldErrors(issuesToFieldErrors(validationIssues));
      setSubmitErrors(issuesToSubmitErrorLines(validationIssues));
      void showCreateCaseValidationSwal(validationIssues).then(() =>
        focusFirstCreateCaseFieldIssue(validationIssues)
      );
      return;
    }

    setSubmitErrors([]);
    setFieldErrors({});

    void (async () => {
      const confirm = await Swal.fire({
        title: 'Confirmar envío',
        text: '¿Está seguro de que desea enviar este trámite a revisión?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Enviar a revisión',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#6b7280',
        reverseButtons: true,
      });
      if (!confirm.isConfirmed) return;

      setIsSubmitting(true);

      try {
        await runLocked('Creando trámite y subiendo archivos…', async () => {
          const response = await fetch('/api/cases', {
            method: 'POST',
            body: buildFormData(),
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({} as Record<string, unknown>));
            if (response.status === 400 && Array.isArray(error.details)) {
              const apiIssues: CreateCaseFormFieldIssue[] = (
                error.details as Array<{ path?: (string | number)[]; message?: string }>
              )
                .map((d) => {
                  const pathKey = d.path?.[0]?.toString() ?? 'form';
                  const field = zodPathToFormField(pathKey);
                  return {
                    field,
                    label: CREATE_CASE_FIELD_LABELS[field],
                    message: typeof d.message === 'string' ? d.message : 'Dato inválido.',
                  };
                })
                .filter((i) => i.message.length > 0);
              if (apiIssues.length > 0) {
                setFieldErrors(issuesToFieldErrors(apiIssues));
                setSubmitErrors(issuesToSubmitErrorLines(apiIssues));
                await showCreateCaseValidationSwal(apiIssues);
                focusFirstCreateCaseFieldIssue(apiIssues);
                return;
              }
            }
            const msg =
              response.status === 413
                ? buildPayloadTooLargeUserMessage(documentFiles)
                : getApiErrorMessage(error, 'No se pudo crear el trámite. Revise los datos e intente de nuevo.', {
                    httpStatus: response.status,
                    uploadFiles: documentFiles,
                  });
            throw new Error(msg);
          }

          const data = await response.json();
          const row = data?.data as { id?: string | number; caseNumber?: string } | undefined;
          const id = row?.id != null ? String(row.id) : null;
          const caseNum = typeof row?.caseNumber === 'string' ? row.caseNumber : null;

          if (!id) {
            router.push('/cases');
            return;
          }

          const numLine = caseNum
            ? `<p style="margin-top:12px"><strong>Número de trámite:</strong> <span style="font-family:monospace">${escapeSwalHtml(caseNum)}</span></p>`
            : '';
          const next = await Swal.fire({
            icon: 'success',
            title: 'Trámite creado con éxito',
            html: `<p style="text-align:left">Su solicitud fue enviada a revisión legal y firma de documentos.</p>${numLine}`,
            showCancelButton: true,
            confirmButtonText: 'Ver trámite',
            cancelButtonText: 'Ir al listado',
            confirmButtonColor: '#2563eb',
            cancelButtonColor: '#6b7280',
            reverseButtons: true,
          });
          if (next.isConfirmed) router.push(`/cases/${id}`);
          else if (next.dismiss === Swal.DismissReason.cancel) router.push('/cases');
        });
      } catch (error: unknown) {
        const msg =
          error instanceof Error
            ? error.message
            : 'No se pudo crear correctamente el trámite. Intente nuevamente.';
        await Swal.fire({
          icon: 'error',
          title: 'No se pudo crear el trámite',
          html: `<p style="text-align:left;white-space:pre-wrap;font-size:14px">${escapeSwalHtml(msg)}</p>`,
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#2563eb',
        });
      } finally {
        setIsSubmitting(false);
      }
    })();
  };

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="relative space-y-6 bg-white p-4 sm:p-6 rounded-lg shadow max-w-4xl mx-auto"
        aria-busy={formBusy}
      >
      <fieldset disabled={formBusy} className="space-y-6 border-0 p-0 m-0 min-w-0">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">
        Solicitud Revisión Legal y Firma de Documentos
      </h2>

      {catalogsError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{catalogsError}</div>
      ) : null}

      {/* Título (resumen interno) */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
          Título del trámite (Resumen) <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={3}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 ${
            fieldErrors.title
              ? 'border-red-400 focus:ring-red-500'
              : 'border-gray-300 focus:ring-blue-500'
          }`}
          placeholder="Resumen breve del trámite..."
        />
        {fieldErrors.title ? <p className="mt-1 text-xs text-red-600">{fieldErrors.title}</p> : null}
      </div>

      {/* Asesor Comercial */}
      <div>
        <label htmlFor="advisorName" className="block text-sm font-medium text-gray-700 mb-2">
          1. Asesor Comercial o Responsable de Solicitud <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="advisorName"
          value={advisorName}
          onChange={(e) => setAdvisorName(e.target.value)}
          required
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 ${
            fieldErrors.advisorName
              ? 'border-red-400 focus:ring-red-500'
              : 'border-gray-300 focus:ring-blue-500'
          }`}
          placeholder="Nombre completo del asesor"
        />
        {fieldErrors.advisorName ? <p className="mt-1 text-xs text-red-600">{fieldErrors.advisorName}</p> : null}
      </div>

      {/* Agregar Documentos */}
      <div>
        <label htmlFor="documentFiles" className="block text-sm font-medium text-gray-700 mb-2">
          2. Agregar Documentos <span className="text-red-500">*</span>
        </label>
        
        <div className="mb-3 w-full">
          <div
            className={`w-full rounded-lg border-2 border-dashed bg-gray-50 transition-colors hover:bg-gray-100/80 focus-within:ring-2 ${
              fieldErrors.documentFiles
                ? 'border-red-300 focus-within:ring-red-500'
                : 'border-gray-300 focus-within:ring-blue-500'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDropFiles(Array.from(e.dataTransfer.files || []));
            }}
          >
            <div
              role="button"
              tabIndex={0}
              className="flex cursor-pointer flex-col items-center justify-center px-4 py-6 outline-none"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
              }}
            >
              <Upload className="mb-3 h-10 w-10 text-gray-400" />
              <p className="mb-2 text-center text-sm text-gray-500">
                <span className="font-semibold text-gray-700">Clic para subir</span> o arrastra y suelta
              </p>
              <p className="text-center text-xs text-gray-500">
                PDF, DOC, DOCX (máx. 50 MB por archivo; hasta 55 MB en total)
              </p>
            </div>

            {documentFiles.length > 0 ? (
              <div className="border-t border-gray-200/90 px-3 pb-4 pt-1">
                <p className="mb-2 text-xs font-medium text-gray-600">
                  {documentFiles.length} archivo{documentFiles.length === 1 ? '' : 's'} en este trámite
                </p>
                <ul className="space-y-2">
                  {documentFiles.map((file, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <FileText className="h-5 w-5 flex-shrink-0 text-blue-600" />
                        <span className="truncate text-sm font-medium text-gray-900">{file.name}</span>
                        <span className="flex-shrink-0 text-xs text-gray-500">
                          ({(file.size / 1024).toFixed(2)} KB)
                        </span>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIndicePrevisualizar(index);
                            setDocumentPreviewOpen(true);
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-800 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                          aria-label={`Vista previa de ${file.name}`}
                          title={
                            file.name.toLowerCase().endsWith('.pdf')
                              ? 'Vista previa'
                              : 'Vista previa solo para PDF'
                          }
                        >
                          <Eye className="h-5 w-5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(index);
                          }}
                          className="text-red-600 hover:text-red-800"
                          aria-label={`Quitar ${file.name}`}
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 border-t border-gray-200/80 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDocumentPreviewOpen(true);
                        }}
                        disabled={documentFiles.length === 0}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-800 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Abrir vista previa del documento en ventana"
                        title="Vista previa (modal)"
                      >
                        <Eye className="h-5 w-5" aria-hidden />
                      </button>
                    </div>
                    {documentFiles.length > 1 ? (
                      <label className="flex max-w-full items-center gap-2 text-xs text-gray-600">
                        <span className="shrink-0">Ver:</span>
                        <select
                          className="max-w-[10rem] rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 sm:max-w-[18rem]"
                          value={indicePrevisualizar}
                          onChange={(e) => setIndicePrevisualizar(Number(e.target.value))}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {documentFiles.map((f, i) => (
                            <option key={`${f.name}-${i}`} value={i}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <input
              type="file"
              id="documentFiles"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx"
              multiple
              required={documentFiles.length === 0}
            />
          </div>
        </div>
        {fieldErrors.documentFiles ? (
          <p className="-mt-1 mb-2 text-xs text-red-600">{fieldErrors.documentFiles}</p>
        ) : null}
        
        <p className="mt-2 text-xs text-gray-500">
          IMPORTANTE: Los documentos se subirán automáticamente al crear el trámite.
        </p>
      </div>

      {/* Código Odoo */}
      <div>
        <label htmlFor="odooCode" className="block text-sm font-medium text-gray-700 mb-2">
          3. # Odoo (si aplica)
        </label>
        <input
          type="text"
          id="odooCode"
          value={odooCode}
          onChange={(e) => setOdooCode(e.target.value)}
          maxLength={6}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 ${
            fieldErrors.odooCode
              ? 'border-red-400 focus:ring-red-500'
              : 'border-gray-300 focus:ring-blue-500'
          }`}
          placeholder="Ej: S12345"
        />
        {fieldErrors.odooCode ? <p className="mt-1 text-xs text-red-600">{fieldErrors.odooCode}</p> : null}
        <p className="mt-1 text-xs text-gray-500">
          Este código debe tener como máximo 6 caracteres, empezando con la letra "S". No es obligatorio.
        </p>
      </div>

      {/* Cliente / Proveedor */}
      <div>
        <label htmlFor="clientProvider" className="block text-sm font-medium text-gray-700 mb-2">
          4. Cliente / Proveedor <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="clientProvider"
          value={clientProvider}
          onChange={(e) => setClientProvider(e.target.value)}
          required
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 ${
            fieldErrors.clientProvider
              ? 'border-red-400 focus:ring-red-500'
              : 'border-gray-300 focus:ring-blue-500'
          }`}
          placeholder="Nombre del cliente o proveedor"
        />
        {fieldErrors.clientProvider ? <p className="mt-1 text-xs text-red-600">{fieldErrors.clientProvider}</p> : null}
      </div>

      {/* Tipo de Documento */}
      <div>
        <label htmlFor="documentType" className="block text-sm font-medium text-gray-700 mb-2">
          5. Tipo de Documento <span className="text-red-500">*</span>
        </label>
        <select
          id="documentType"
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value as DocumentType)}
          required
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 ${
            fieldErrors.documentType
              ? 'border-red-400 focus:ring-red-500'
              : 'border-gray-300 focus:ring-blue-500'
          }`}
        >
          {docTypes.map((t) => (
            <option key={t.code} value={t.code}>
              {t.label}
            </option>
          ))}
        </select>
        {fieldErrors.documentType ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.documentType}</p>
        ) : null}
      </div>

      {/* Monto (paso 6) — mismo formato que el resto de ítems */}
      <div id="amountApplies-section">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          6. ¿Aplica monto? <span className="text-red-500">*</span>
        </label>
        <p className="mb-3 text-xs text-gray-500">
          Si indica Sí, debe ingresar el monto. Si el monto alcanza el umbral definido por administración, se notificará
          a {amountAlertAreasText}.
        </p>
        <div className="flex flex-wrap gap-6">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-900">
            <input
              type="radio"
              name="amountAppliesChoice"
              className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={amountAppliesChoice === 'yes'}
              onChange={() => setAmountAppliesChoice('yes')}
            />
            Sí
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-900">
            <input
              type="radio"
              name="amountAppliesChoice"
              className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={amountAppliesChoice === 'no'}
              onChange={() => {
                setAmountAppliesChoice('no');
                setAmountValue('');
              }}
            />
            No
          </label>
        </div>
        {fieldErrors.amountApplies ? (
          <p className="mt-2 text-xs text-red-600">{fieldErrors.amountApplies}</p>
        ) : null}

        {amountAppliesChoice === 'yes' ? (
          <div className="mt-4">
            <label htmlFor="amountValue" className="block text-sm font-medium text-gray-700 mb-2">
              Monto (USD) <span className="text-red-500">*</span>
            </label>
            <input
              id="amountValue"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amountValue}
              onChange={(e) => setAmountValue(e.target.value)}
              required
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 ${
                fieldErrors.amountValue
                  ? 'border-red-400 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              placeholder="0.00"
            />
            {fieldErrors.amountValue ? (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.amountValue}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="requestDate" className="block text-sm font-medium text-gray-700 mb-2">
            7. Fecha de la solicitud <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="requestDate"
            value={requestDate}
            onChange={(e) => setRequestDate(e.target.value)}
            min={todayYmd}
            required
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 ${
              fieldErrors.requestDate
                ? 'border-red-400 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500'
            }`}
          />
          {fieldErrors.requestDate ? <p className="mt-1 text-xs text-red-600">{fieldErrors.requestDate}</p> : null}
        </div>

        <div>
          <label htmlFor="requiredDeliveryDate" className="block text-sm font-medium text-gray-700 mb-2">
            8. Fecha de entrega requerida <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="requiredDeliveryDate"
            value={requiredDeliveryDate}
            onChange={(e) => setRequiredDeliveryDate(e.target.value)}
            min={minDeliveryYmd}
            required
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 ${
              fieldErrors.requiredDeliveryDate
                ? 'border-red-400 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500'
            }`}
          />
          {fieldErrors.requiredDeliveryDate ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.requiredDeliveryDate}</p>
          ) : null}
          <p className="mt-1 text-xs text-gray-500">
            Fecha máxima que se requiere para entrega del documento firmado al cliente
          </p>
        </div>
      </div>

      {/* Urgencia - Justificación */}
      <div>
        <label htmlFor="urgencyJustification" className="block text-sm font-medium text-gray-700 mb-2">
          9. Urgencia - Justificación
        </label>
        <textarea
          id="urgencyJustification"
          value={urgencyJustification}
          onChange={(e) => setUrgencyJustification(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          placeholder="Si la fecha de entrega es para el mismo día o hasta 24h posteriores, incluya la justificación..."
        />
        <p className="mt-1 text-xs text-gray-500">
          Si la fecha de entrega es urgente, debe incluir la justificación y el impacto potencial.
        </p>
      </div>

      {/* Tipo de Firma */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          10. Tipo de Firma <span className="text-red-500">*</span>
        </label>
        <select
          id="signatureType"
          value={signatureType}
          onChange={(e) => setSignatureType(e.target.value as SignatureType)}
          required
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 ${
            fieldErrors.signatureType
              ? 'border-red-400 focus:ring-red-500'
              : 'border-gray-300 focus:ring-blue-500'
          }`}
        >
          {sigTypes.map((t) => (
            <option key={t.code} value={t.code}>
              {t.label}
            </option>
          ))}
        </select>
        {fieldErrors.signatureType ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.signatureType}</p>
        ) : null}
      </div>

      {/* Tipo de Plantilla */}
      <div>
        <label htmlFor="templateType" className="block text-sm font-medium text-gray-700 mb-2">
          11. Tipo de Plantilla <span className="text-red-500">*</span>
        </label>
        <select
          id="templateType"
          value={templateType}
          onChange={(e) => setTemplateType(e.target.value as TemplateType)}
          required
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 ${
            fieldErrors.templateType
              ? 'border-red-400 focus:ring-red-500'
              : 'border-gray-300 focus:ring-blue-500'
          }`}
        >
          {tplTypes.map((t) => (
            <option key={t.code} value={t.code}>
              {t.label}
            </option>
          ))}
        </select>
        {fieldErrors.templateType ? (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.templateType}</p>
        ) : null}
      </div>

      {/* Observaciones */}
      <div>
        <label htmlFor="observations" className="block text-sm font-medium text-gray-700 mb-2">
          12. Observaciones
        </label>
        <textarea
          id="observations"
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          placeholder="Recomendamos incluir las observaciones del proceso de revisión con CORA IA
          "
        />
      </div>

      <button
        type="submit"
        disabled={formBusy || catalogsLoading}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-base"
      >
        {formBusy ? 'Enviando…' : 'Crear y enviar a revisión'}
      </button>

      {submitErrors.length ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="font-medium">Revise lo siguiente antes de continuar:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {submitErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      </fieldset>
    </form>

      {documentPreviewOpen && documentFiles.length > 0 && !formBusy ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-doc-preview-title"
          onClick={closeDocumentPreview}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 sm:px-5">
              <h3
                id="create-doc-preview-title"
                className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 sm:text-base"
              >
                {documentFiles[indicePrevisualizar]?.name ?? 'Vista previa'}
              </h3>
              <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                {documentFiles.length > 1 ? (
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="shrink-0">Archivo:</span>
                    <select
                      className="max-w-[12rem] rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 sm:max-w-[20rem]"
                      value={indicePrevisualizar}
                      onChange={(e) => setIndicePrevisualizar(Number(e.target.value))}
                    >
                      {documentFiles.map((f, i) => (
                        <option key={`modal-${f.name}-${i}`} value={i}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <button
                  type="button"
                  onClick={closeDocumentPreview}
                  className="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  title="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-gray-100 p-2 sm:p-4">
              {urlVistaPreviaPdf ? (
                <iframe
                  title={`Vista previa: ${documentFiles[indicePrevisualizar]?.name ?? ''}`}
                  src={urlVistaPreviaPdf}
                  className="h-[75vh] max-h-[720px] w-full min-h-[400px] rounded-md border border-gray-200 bg-white"
                />
              ) : (
                <div className="flex min-h-[280px] flex-col items-center justify-center rounded-md border border-amber-200 bg-amber-50 px-4 py-8 text-center">
                  <FileText className="mb-3 h-10 w-10 text-amber-700" aria-hidden />
                  <p className="max-w-md text-sm text-amber-950">
                    <span className="font-medium">Vista previa solo para PDF.</span> El archivo seleccionado no es
                    .pdf; ábralo en su equipo o adjunte una copia en PDF si necesita verla aquí.
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
