import type { DocumentoContractual } from '@/types/hbi/operacion.types';

function esImagen(mime?: string, nombre?: string): boolean {
  if (mime?.startsWith('image/')) return true;
  const n = (nombre ?? '').toLowerCase();
  return /\.(png|jpe?g|gif|webp|svg)$/.test(n);
}

function esPdf(mime?: string, nombre?: string): boolean {
  if (mime === 'application/pdf') return true;
  return (nombre ?? '').toLowerCase().endsWith('.pdf');
}

/** URL para abrir o incrustar vista previa (demo: HTML sintético si no hay archivo real). */
export function urlVistaPreviaDocumento(doc: DocumentoContractual): string {
  if (doc.blobUrl) return doc.blobUrl;
  const dataUrl = doc.datosExtraidos?.previewDataUrl;
  if (typeof dataUrl === 'string' && dataUrl.length > 0) return dataUrl;

  const extra = doc.datosExtraidos ?? {};
  const monto =
    typeof extra.posibleMonto === 'string' ? extra.posibleMonto : undefined;
  const hash =
    typeof extra.hashContenido === 'string' ? extra.hashContenido : undefined;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>${escapeHtml(doc.nombreArchivo)}</title>
<style>
body{font-family:system-ui,sans-serif;margin:2rem;line-height:1.5;color:#0f172a;background:#f8fafc}
h1{font-size:1.25rem;color:#1e3a8a}
.badge{display:inline-block;background:#dbeafe;color:#1e40af;padding:.25rem .75rem;border-radius:999px;font-size:.75rem;font-weight:600}
dl{margin-top:1.5rem;display:grid;gap:.75rem}
dt{font-size:.7rem;text-transform:uppercase;color:#64748b}
dd{margin:0;font-size:.95rem}
footer{margin-top:2rem;font-size:.75rem;color:#94a3b8}
</style></head><body>
<h1>${escapeHtml(doc.nombreArchivo)}</h1>
<p><span class="badge">${escapeHtml(doc.tipoDocumento)}</span></p>
<p>Vista previa de demostración HBI — el archivo contractual queda registrado en el expediente de la operación.</p>
<dl>
<dt>Operación</dt><dd>${escapeHtml(doc.operacionId)}</dd>
<dt>Registrado</dt><dd>${escapeHtml(new Date(doc.creadoEn).toLocaleString('es-CO'))}</dd>
${monto ? `<dt>Monto detectado</dt><dd>${escapeHtml(monto)}</dd>` : ''}
${hash ? `<dt>Huella demo</dt><dd style="font-family:monospace;font-size:.8rem">${escapeHtml(hash)}</dd>` : ''}
</dl>
<footer>HBI Agente de Financiación · modo demo</footer>
</body></html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function tipoVistaPreviaDocumento(
  doc: DocumentoContractual
): 'imagen' | 'pdf' | 'html' | 'descargar' {
  const mime = doc.mimeType;
  const nombre = doc.nombreArchivo;
  const url = urlVistaPreviaDocumento(doc);

  if (esImagen(mime, nombre) && url.startsWith('data:image/')) return 'imagen';
  if (esImagen(mime, nombre)) return 'imagen';
  if (esPdf(mime, nombre) && url.startsWith('data:application/pdf')) return 'pdf';
  if (esPdf(mime, nombre) && !url.startsWith('data:text/html')) return 'pdf';
  if (url.startsWith('data:text/html')) return 'html';
  if (url.startsWith('blob:') && esPdf(mime, nombre)) return 'pdf';
  if (url.startsWith('blob:') && esImagen(mime, nombre)) return 'imagen';
  return 'html';
}

export async function archivoADatosPreview(file: File): Promise<{
  previewDataUrl: string;
  mimeType: string;
  tamanoBytes: number;
}> {
  const tamanoBytes = file.size;
  const mimeType = file.type || 'application/octet-stream';

  if (file.size > 4_500_000) {
    return { previewDataUrl: '', mimeType, tamanoBytes };
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const base64 = btoa(binary);
  const previewDataUrl = `data:${mimeType};base64,${base64}`;
  return { previewDataUrl, mimeType, tamanoBytes };
}
