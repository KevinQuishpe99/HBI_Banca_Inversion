'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import {
  Canvas,
  PencilBrush,
  IText,
  type FabricObject,
  type TPointerEventInfo,
} from 'fabric';
import {
  Loader2,
  MousePointer2,
  Pen,
  Highlighter,
  Underline,
  Type,
  Undo2,
  Trash2,
  Save,
  X,
} from 'lucide-react';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

type Tool = 'select' | 'pen' | 'highlighter' | 'underline' | 'text';

type PagePair = { pdf: HTMLCanvasElement; fabric: Canvas };

type UndoEntry = { fabric: Canvas; target: FabricObject };

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  if (!base64) throw new Error('Datos de imagen inválidos');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function loadImageDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo generar la imagen de anotaciones'));
    img.src = dataUrl;
  });
}

type Props = {
  pdfUrl: string;
  fileId: string;
  fileName: string;
  onClose: () => void;
  onSaved: () => void;
  /** Heartbeat para liberar bloqueo de anotación por archivo (usuarios de área). */
  useAnnotationLock?: boolean;
  /** Notifica al padre cuando hay guardado en curso (bloquear cierre del modal / Escape). */
  onSavingChange?: (saving: boolean) => void;
};

export function PdfAnnotatorViewer({
  pdfUrl,
  fileId,
  fileName,
  onClose,
  onSaved,
  useAnnotationLock = true,
  onSavingChange,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pagesReady, setPagesReady] = useState(0);
  const [tool, setTool] = useState<Tool>('pen');
  /** Colores por herramienta (estilo similar a Edge PDF: lápiz rojo, resaltador amarillo, subrayado oscuro). */
  const [colorPen, setColorPen] = useState('#e53935');
  const [colorHighlight, setColorHighlight] = useState('#ffeb3b');
  const [colorUnderline, setColorUnderline] = useState('#212121');
  const [colorText, setColorText] = useState('#212121');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    onSavingChange?.(saving);
  }, [saving, onSavingChange]);

  const pagePairsRef = useRef<PagePair[]>([]);
  const readyPageIndices = useRef<Set<number>>(new Set());
  const undoStackRef = useRef<UndoEntry[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  /** Ancho medido (ResizeObserver); el render del PDF usa versión debounced para no disparar pdf.js en el mismo canvas muchas veces. */
  const [renderMaxWidth, setRenderMaxWidth] = useState(1024);
  const [debouncedRenderWidth, setDebouncedRenderWidth] = useState(1024);

  /** Red de seguridad: el worker de pdf.js a veces rechaza con "aborted" fuera de nuestras promesas (p. ej. HMR). */
  useEffect(() => {
    const onUnhandledRejection = (e: PromiseRejectionEvent) => {
      if (isExpectedPdfJsAbort(e.reason)) {
        e.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', onUnhandledRejection);
  }, []);

  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const w = el.clientWidth;
      const usable = Math.max(320, Math.floor(w - 16));
      setRenderMaxWidth(usable);
    };
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedRenderWidth(renderMaxWidth), 220);
    return () => window.clearTimeout(t);
  }, [renderMaxWidth]);

  useEffect(() => {
    if (!useAnnotationLock) return;
    const beat = () => {
      void fetch(`/api/files/${fileId}/annotation-lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'heartbeat' }),
        credentials: 'include',
      }).catch(() => {});
    };
    beat();
    const interval = window.setInterval(beat, 15_000);
    return () => {
      window.clearInterval(interval);
      void fetch(`/api/files/${fileId}/annotation-lock`, { method: 'DELETE', credentials: 'include' }).catch(
        () => {},
      );
    };
  }, [fileId, useAnnotationLock]);

  const registerUndo = useCallback((entry: UndoEntry) => {
    undoStackRef.current.push(entry);
  }, []);

  const undoLast = useCallback(() => {
    const entry = undoStackRef.current.pop();
    if (!entry) return;
    entry.fabric.remove(entry.target);
    entry.fabric.requestRenderAll();
  }, []);

  useEffect(() => {
    pagePairsRef.current = [];
    readyPageIndices.current = new Set();
    undoStackRef.current = [];
    setPagesReady(0);
    setPdfDoc(null);
    setNumPages(0);
    let cancelled = false;
    let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;
    (async () => {
      try {
        const res = await fetch(pdfUrl, { credentials: 'include' });
        if (!res.ok) throw new Error('No se pudo cargar el PDF');
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        loadingTask = pdfjsLib.getDocument({ data: buf });
        const pdf = await loadingTask.promise;
        if (cancelled) {
          // destroy() devuelve Promise; puede rechazar con "aborted" (p. ej. Fast Refresh)
          void pdf.destroy().catch(() => {});
          return;
        }
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
      } catch (e) {
        if (cancelled || isExpectedPdfJsAbort(e)) return;
        setLoadError(e instanceof Error ? e.message : 'Error al cargar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (loadingTask) {
        // destroy() rechaza loadingTask.promise y la promesa de loadingTask.destroy()
        void loadingTask.promise.catch(() => {});
        void loadingTask.destroy().catch(() => {});
      }
    };
  }, [pdfUrl]);

  const onPageCanvasReady = useCallback((index: number, pair: PagePair, totalPages: number) => {
    pagePairsRef.current[index] = pair;
    readyPageIndices.current.add(index);
    let all = true;
    for (let i = 0; i < totalPages; i++) {
      if (!readyPageIndices.current.has(i)) {
        all = false;
        break;
      }
    }
    setPagesReady(all ? totalPages : readyPageIndices.current.size);
  }, []);

  const clearAllAnnotations = useCallback(() => {
    undoStackRef.current = [];
    for (const pair of pagePairsRef.current) {
      if (!pair?.fabric) continue;
      pair.fabric.clear();
      pair.fabric.requestRenderAll();
    }
  }, []);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    if (numPages === 0) return;
    const pairs = pagePairsRef.current;
    if (pairs.length < numPages || !pairs.slice(0, numPages).every(Boolean)) {
      setSaveError('Espere a que termine de cargar el documento.');
      return;
    }
    setSaving(true);
    try {
      const pdfOut = await PDFDocument.create();
      for (let i = 0; i < numPages; i++) {
        const pair = pairs[i];
        if (!pair) throw new Error('Página incompleta');
        const { pdf: pdfCanvas, fabric } = pair;
        const merged = document.createElement('canvas');
        merged.width = pdfCanvas.width;
        merged.height = pdfCanvas.height;
        const mctx = merged.getContext('2d');
        if (!mctx) throw new Error('Canvas no disponible');
        mctx.drawImage(pdfCanvas, 0, 0);
        const fabricDataUrl = fabric.toDataURL({ format: 'png', multiplier: 1 });
        const fabricImg = await loadImageDataUrl(fabricDataUrl);
        mctx.drawImage(fabricImg, 0, 0);
        const dataUrl = merged.toDataURL('image/png');
        const pngBytes = dataUrlToUint8Array(dataUrl);
        const pngImage = await pdfOut.embedPng(pngBytes);
        const w = pngImage.width;
        const h = pngImage.height;
        const page = pdfOut.addPage([w, h]);
        page.drawImage(pngImage, { x: 0, y: 0, width: w, height: h });
      }
      const outBytes = await pdfOut.save();
      const blob = new Blob([new Uint8Array(outBytes)], { type: 'application/pdf' });
      const file = new File([blob], fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`, {
        type: 'application/pdf',
      });
      const form = new FormData();
      form.append('file', file);
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
      setSaving(false);
      onSaved();
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Error al guardar');
      setSaving(false);
    }
  }, [fileId, fileName, numPages, onClose, onSaved]);

  const allPagesRendered = numPages > 0 && pagesReady >= numPages;

  const activeColor =
    tool === 'highlighter'
      ? colorHighlight
      : tool === 'underline'
        ? colorUnderline
        : tool === 'text'
          ? colorText
          : colorPen;

  const setActiveColor = (hex: string) => {
    if (tool === 'highlighter') setColorHighlight(hex);
    else if (tool === 'underline') setColorUnderline(hex);
    else if (tool === 'text') setColorText(hex);
    else setColorPen(hex);
  };

  const uiLocked = saving;

  return (
    <>
      {saving ? (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="pdf-annotate-saving-title"
          aria-busy="true"
        >
          <div className="max-w-md rounded-xl border border-slate-200/90 bg-white px-8 py-10 text-center shadow-2xl ring-1 ring-slate-900/10">
            <Loader2 className="mx-auto h-11 w-11 animate-spin text-slate-700" aria-hidden />
            <p id="pdf-annotate-saving-title" className="mt-5 text-lg font-semibold text-slate-900">
              Guardando anotaciones
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Por favor espere. No cierre esta ventana ni pulse fuera hasta que termine el guardado.
            </p>
          </div>
        </div>
      ) : null}
    <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xl ring-1 ring-slate-900/5">
      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/90 px-3 py-2.5 sm:px-4">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight text-slate-900">{fileName}</span>
        <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-slate-200/80 bg-white p-0.5 shadow-sm">
          <button
            type="button"
            onClick={() => setTool('select')}
            disabled={uiLocked}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              tool === 'select' ? 'bg-slate-100 text-slate-900 shadow-inner' : 'text-slate-600 hover:bg-slate-50'
            } disabled:cursor-not-allowed disabled:opacity-50`}
            title="Seleccionar y mover"
          >
            <MousePointer2 className="h-4 w-4" />
            Seleccionar
          </button>
          <button
            type="button"
            onClick={() => setTool('pen')}
            disabled={uiLocked}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              tool === 'pen' ? 'bg-slate-100 text-slate-900 shadow-inner' : 'text-slate-600 hover:bg-slate-50'
            } disabled:cursor-not-allowed disabled:opacity-50`}
            title="Trazo libre"
          >
            <Pen className="h-4 w-4" />
            Trazo
          </button>
          <button
            type="button"
            onClick={() => setTool('highlighter')}
            disabled={uiLocked}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              tool === 'highlighter' ? 'bg-slate-100 text-slate-900 shadow-inner' : 'text-slate-600 hover:bg-slate-50'
            } disabled:cursor-not-allowed disabled:opacity-50`}
            title="Resaltador (trazo ancho semitransparente)"
          >
            <Highlighter className="h-4 w-4" />
            Resaltar
          </button>
          <button
            type="button"
            onClick={() => setTool('underline')}
            disabled={uiLocked}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              tool === 'underline' ? 'bg-slate-100 text-slate-900 shadow-inner' : 'text-slate-600 hover:bg-slate-50'
            } disabled:cursor-not-allowed disabled:opacity-50`}
            title="Subrayar (línea fina; mantén Mayús para línea recta)"
          >
            <Underline className="h-4 w-4" />
            Subrayar
          </button>
          <button
            type="button"
            onClick={() => setTool('text')}
            disabled={uiLocked}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              tool === 'text' ? 'bg-slate-100 text-slate-900 shadow-inner' : 'text-slate-600 hover:bg-slate-50'
            } disabled:cursor-not-allowed disabled:opacity-50`}
            title="Añadir texto editable"
          >
            <Type className="h-4 w-4" />
            Texto
          </button>
          {tool !== 'select' ? (
            <label className="ml-0.5 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 shadow-sm">
              <span className="hidden text-[11px] font-medium text-slate-500 sm:inline">
                {tool === 'pen'
                  ? 'Color del trazo'
                  : tool === 'highlighter'
                    ? 'Color del resaltador'
                    : tool === 'underline'
                      ? 'Color del subrayado'
                      : 'Color del texto'}
              </span>
              <input
                type="color"
                value={activeColor}
                onChange={(e) => setActiveColor(e.target.value)}
                disabled={uiLocked}
                className="h-7 w-9 cursor-pointer rounded border border-slate-200 bg-white p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                title="Color de la herramienta activa"
                aria-label="Color de anotación"
              />
            </label>
          ) : null}
        </div>
        <button
          type="button"
          onClick={undoLast}
          disabled={uiLocked}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          title="Deshacer la última anotación"
        >
          <Undo2 className="h-4 w-4" />
          Deshacer
        </button>
        <button
          type="button"
          onClick={clearAllAnnotations}
          disabled={uiLocked}
          className="inline-flex items-center gap-1 rounded-md border border-amber-200/90 bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100/90 disabled:cursor-not-allowed disabled:opacity-50"
          title="Quita todas las anotaciones (no guarda hasta pulsar «Guardar anotaciones»)"
        >
          <Trash2 className="h-4 w-4" />
          Borrar todo
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !allPagesRendered}
          className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-900 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar anotaciones
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={uiLocked}
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          title={uiLocked ? 'Espere a que termine el guardado' : 'Cerrar'}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      {saveError ? <p className="bg-red-50 px-3 py-2 text-sm text-red-800">{saveError}</p> : null}
      <div
        ref={scrollAreaRef}
        className="min-h-0 flex-1 overflow-auto bg-slate-100/80 p-3 sm:p-4"
      >
        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center gap-2 text-gray-600">
            <Loader2 className="h-8 w-8 animate-spin" />
            Cargando PDF…
          </div>
        ) : null}
        {loadError ? (
          <p className="text-center text-sm text-red-700">{loadError}</p>
        ) : null}
        {pdfDoc && numPages > 0 ? (
          <div className="mx-auto flex w-full max-w-full flex-col gap-4">
            {Array.from({ length: numPages }, (_, idx) => (
              <PdfPageBlock
                key={idx + 1}
                pdfDocument={pdfDoc}
                pageNumber={idx + 1}
                maxRenderWidth={debouncedRenderWidth}
                tool={tool}
                color={activeColor}
                onReady={(pair) => onPageCanvasReady(idx, pair, numPages)}
                onObjectAdded={registerUndo}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
    </>
  );
}

type PageProps = {
  pageNumber: number;
  pdfDocument: PDFDocumentProxy;
  /** Ancho máximo en píxeles para la página renderizada (encaja al ancho del modal). */
  maxRenderWidth: number;
  tool: Tool;
  color: string;
  onReady: (pair: PagePair) => void;
  onObjectAdded: (entry: UndoEntry) => void;
};

function isRenderingCancelled(err: unknown): boolean {
  if (err == null) return false;
  if (typeof err === 'object' && err !== null && 'name' in err) {
    return String((err as { name: string }).name) === 'RenderingCancelledException';
  }
  return false;
}

/** pdf.js rechaza promesas con "aborted" al destruir la tarea de carga o cancelar el render; no debe mostrarse como error. */
function isExpectedPdfJsAbort(err: unknown, depth = 0): boolean {
  if (depth > 4) return false;
  if (isRenderingCancelled(err)) return true;
  if (err == null) return false;
  if (typeof err === 'object' && err !== null) {
    const o = err as { name?: unknown; message?: unknown; details?: unknown; cause?: unknown };
    if (o.name != null) {
      const n = String(o.name);
      if (
        n === 'AbortError' ||
        n === 'UnknownErrorException' ||
        n === 'RenderingCancelledException'
      ) {
        return true;
      }
    }
    for (const key of ['message', 'details'] as const) {
      const v = o[key];
      if (typeof v === 'string' && isAbortLikeMessage(v)) return true;
    }
    if (o.cause != null && isExpectedPdfJsAbort(o.cause, depth + 1)) return true;
  }
  if (err instanceof Error) {
    if (isAbortLikeMessage(err.message)) return true;
    if (err.cause != null && isExpectedPdfJsAbort(err.cause, depth + 1)) return true;
  }
  const fallback = String(err);
  return isAbortLikeMessage(fallback);
}

function isAbortLikeMessage(raw: string): boolean {
  const msg = raw.trim();
  if (!msg) return false;
  if (/^aborted$/i.test(msg)) return true;
  return /cancel(l)?ed|destroyed|worker was|transport destroyed|rendering.*cancel|aborted|queue/i.test(
    msg,
  );
}

function applyToolToFabric(
  fc: Canvas,
  tool: Tool,
  color: string,
  textHandlerRef: React.MutableRefObject<((opt: TPointerEventInfo) => void) | null>,
) {
  if (textHandlerRef.current) {
    fc.off('mouse:down', textHandlerRef.current);
    textHandlerRef.current = null;
  }
  fc.discardActiveObject();

  if (tool === 'select') {
    fc.isDrawingMode = false;
    fc.selection = true;
    fc.defaultCursor = 'default';
    fc.requestRenderAll();
    return;
  }

  if (tool === 'text') {
    fc.isDrawingMode = false;
    fc.selection = true;
    fc.defaultCursor = 'text';
    const handler = (opt: TPointerEventInfo) => {
      if (opt.target) return;
      const pointer = fc.getPointer(opt.e);
      const itext = new IText('Texto', {
        left: pointer.x,
        top: pointer.y,
        fill: color,
        fontSize: 18,
        fontFamily: 'system-ui, Segoe UI, sans-serif',
      });
      fc.add(itext);
      fc.setActiveObject(itext);
      itext.enterEditing();
      itext.selectAll();
    };
    textHandlerRef.current = handler;
    fc.on('mouse:down', handler);
    fc.requestRenderAll();
    return;
  }

  fc.isDrawingMode = true;
  fc.selection = false;
  fc.defaultCursor = 'crosshair';
  const brush = new PencilBrush(fc);
  brush.color = color;
  brush.width = 2.5;
  if (tool === 'highlighter') {
    brush.color = hexToRgba(color, 0.38);
    brush.width = 28;
  }
  if (tool === 'underline') {
    brush.width = 4;
    brush.color = color;
  }
  fc.freeDrawingBrush = brush;
  fc.requestRenderAll();
}

function PdfPageBlock({
  pageNumber,
  pdfDocument,
  maxRenderWidth,
  tool,
  color,
  onReady,
  onObjectAdded,
}: PageProps) {
  const pdfRef = useRef<HTMLCanvasElement>(null);
  const annRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(false);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const onReadyRef = useRef(onReady);
  const onObjectAddedRef = useRef(onObjectAdded);
  onReadyRef.current = onReady;
  onObjectAddedRef.current = onObjectAdded;

  const [fabricCanvas, setFabricCanvas] = useState<Canvas | null>(null);
  const textHandlerRef = useRef<((opt: TPointerEventInfo) => void) | null>(null);
  const renderGenRef = useRef(0);

  useEffect(() => {
    const myGen = ++renderGenRef.current;
    let cancelled = false;
    readyRef.current = false;
    renderTaskRef.current?.cancel();
    renderTaskRef.current = null;
    setFabricCanvas(null);

    (async () => {
      let page: Awaited<ReturnType<PDFDocumentProxy['getPage']>> | null = null;
      let fc: Canvas | null = null;
      try {
        page = await pdfDocument.getPage(pageNumber);
        if (cancelled || renderGenRef.current !== myGen) return;
        const base = page.getViewport({ scale: 1 });
        const maxW = Math.max(320, maxRenderWidth);
        // Hasta 2.25× para aprovechar pantallas anchas sin inflar demasiado la memoria
        const scale = Math.min(2.25, maxW / base.width);
        const viewport = page.getViewport({ scale });
        const canvas = pdfRef.current;
        const ann = annRef.current;
        if (!canvas || !ann || cancelled || renderGenRef.current !== myGen) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        ann.width = viewport.width;
        ann.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const renderTask = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = renderTask;
        try {
          await renderTask.promise;
        } catch (err: unknown) {
          if (
            cancelled ||
            isRenderingCancelled(err) ||
            isExpectedPdfJsAbort(err) ||
            renderGenRef.current !== myGen
          ) {
            return;
          }
          throw err;
        } finally {
          if (renderTaskRef.current === renderTask) renderTaskRef.current = null;
        }

        if (cancelled || renderGenRef.current !== myGen) return;

        fc = new Canvas(ann, {
          width: viewport.width,
          height: viewport.height,
          backgroundColor: 'transparent',
          enableRetinaScaling: false,
        });

        fc.on('object:added', (e) => {
          const t = e.target;
          if (t) onObjectAddedRef.current({ fabric: fc!, target: t });
        });

        if (!readyRef.current && renderGenRef.current === myGen) {
          readyRef.current = true;
          onReadyRef.current({ pdf: canvas, fabric: fc });
        }
        if (renderGenRef.current === myGen) {
          setFabricCanvas(fc);
        }
      } catch (err: unknown) {
        if (cancelled || renderGenRef.current !== myGen || isExpectedPdfJsAbort(err)) return;
        throw err;
      } finally {
        try {
          page?.cleanup();
        } catch {
          /* ignore */
        }
      }
    })().catch((err: unknown) => {
      if (!isExpectedPdfJsAbort(err)) {
        console.error(err);
      }
    });

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      readyRef.current = false;
      setFabricCanvas((prev) => {
        if (prev) {
          try {
            prev.dispose();
          } catch {
            /* ignore */
          }
        }
        return null;
      });
    };
  }, [pdfDocument, pageNumber, maxRenderWidth]);

  useEffect(() => {
    if (!fabricCanvas) return;
    applyToolToFabric(fabricCanvas, tool, color, textHandlerRef);
  }, [fabricCanvas, tool, color]);

  return (
    <div className="relative w-full rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gray-50 px-2 py-1 text-center text-xs text-gray-600">
        Página {pageNumber}
      </div>
      <div className="flex justify-center overflow-auto p-2">
        {/* Fabric envuelve el canvas de anotación en un div; superponemos sobre el PDF con position absolute */}
        <div className="relative inline-block max-w-full">
          {/* Sin max-h en el canvas: un límite de altura encogía todo el PDF (incluido el ancho). El scroll es del área del modal. */}
          {/* Sin w-full: el tamaño visual debe coincidir con width/height del bitmap (nitidez). */}
          <canvas ref={pdfRef} className="relative z-0 block max-w-full" />
          <div className="absolute left-0 top-0 z-10 h-full w-full">
            <canvas ref={annRef} className="pointer-events-auto touch-none h-full w-full max-w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
