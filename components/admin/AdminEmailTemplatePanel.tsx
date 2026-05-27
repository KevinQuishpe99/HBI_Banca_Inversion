'use client';

import { useEffect, useRef, useState } from 'react';
import { EmailPreviewFrame } from '@/components/admin/EmailPreviewFrame';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Eye } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api/parse-api-error';
import { swalAlertSuccess, swalAlertError } from '@/lib/ui/swal';
import {
  adminBtnPrimary,
  adminBtnSecondary,
  adminCard,
  adminInput,
  adminLabel,
  adminPageDesc,
} from '@/lib/ui/admin-ui';
import { mergeEmailTemplateTheme } from '@/lib/email/merge-email-theme';
import {
  formatEmailTemplateValidationMessage,
  getEmailTemplateValidationErrors,
} from '@/lib/email/validate-email-template-theme';
import type { EmailTemplateTheme, LogoMode } from '@/types/email-template';
import { DEFAULT_EMAIL_TEMPLATE_THEME } from '@/types/email-template';

async function apiErrorMessage(res: Response, json: Record<string, unknown>): Promise<string> {
  return getApiErrorMessage(json, 'No se pudo completar la operación.', { httpStatus: res.status });
}

const COLOR_FIELDS: { key: keyof EmailTemplateTheme; label: string; hint?: string }[] = [
  { key: 'bodyBg', label: 'Fondo exterior', hint: 'Zona gris alrededor del bloque del correo' },
  { key: 'contentBg', label: 'Fondo del bloque', hint: 'Área blanca del mensaje' },
  { key: 'headerBg', label: 'Fondo encabezado' },
  { key: 'footerBg', label: 'Fondo pie' },
  { key: 'accentColor', label: 'Botón / acento' },
  { key: 'titleColor', label: 'Títulos' },
  { key: 'textColor', label: 'Texto del cuerpo' },
];

function NumberField({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={adminLabel}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        className={`${adminInput} mt-1 w-28`}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? n : min);
        }}
      />
    </div>
  );
}

export function AdminEmailTemplatePanel() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<EmailTemplateTheme>({ ...DEFAULT_EMAIL_TEMPLATE_THEME });
  const [previewHtml, setPreviewHtml] = useState<string>('');

  const themeQuery = useQuery({
    queryKey: ['admin', 'email-template'],
    queryFn: async () => {
      const res = await fetch('/api/admin/email-template', { credentials: 'include' });
      const json = (await res.json()) as Record<string, unknown> & {
        success?: boolean;
        data?: { theme: EmailTemplateTheme };
      };
      if (!res.ok || !json.success || !json.data?.theme) {
        throw new Error(await apiErrorMessage(res, json));
      }
      return json.data.theme;
    },
  });

  useEffect(() => {
    if (themeQuery.data) setDraft(themeQuery.data);
  }, [themeQuery.data]);

  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/email-template', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: draft,
          sampleMessage: 'Así se verán todos los correos del sistema.',
        }),
      });
      const json = (await res.json()) as Record<string, unknown> & {
        success?: boolean;
        data?: { html: string };
      };
      if (!res.ok || !json.success || !json.data?.html) {
        throw new Error(await apiErrorMessage(res, json));
      }
      return json.data.html;
    },
    onSuccess: (html) => setPreviewHtml(html),
    onError: async (e: Error) => swalAlertError('Vista previa', e.message),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const merged = mergeEmailTemplateTheme(draft);
      const validationErrors = getEmailTemplateValidationErrors(merged);
      if (validationErrors.length > 0) {
        throw new Error(formatEmailTemplateValidationMessage(validationErrors));
      }
      const res = await fetch('/api/admin/email-template', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: merged }),
      });
      const json = (await res.json()) as Record<string, unknown> & {
        success?: boolean;
        data?: { theme: EmailTemplateTheme };
      };
      if (!res.ok || !json.success) {
        throw new Error(await apiErrorMessage(res, json));
      }
      return json.data;
    },
    onSuccess: async (data) => {
      if (data?.theme) setDraft(data.theme);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'email-template'] });
      await swalAlertSuccess(
        'Plantilla guardada',
        'Todos los correos (comunicados, trámites, credenciales) usarán este diseño.'
      );
      previewMutation.mutate();
    },
    onError: async (e: Error) => {
      const text = e.message.includes('Faltan datos obligatorios')
        ? e.message
        : `No se pudo guardar la plantilla.\n\n${e.message}`;
      await swalAlertError('Revisar plantilla', text);
    },
  });

  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!themeQuery.isSuccess) return;
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      previewMutation.mutate();
    }, 450);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, themeQuery.isSuccess]);

  return (
    <section className={adminCard}>
      <div className="border-b border-admin-border px-4 py-3">
        <h2 className="text-base font-semibold text-admin-text">Formato de correos</h2>
        <p className={adminPageDesc}>
          Tamaño, logo, colores y pie personalizado. Lo que guarde aquí se aplica a todos los correos
          automáticos y comunicados.
        </p>
      </div>
      <div className="grid gap-6 p-4 xl:grid-cols-2">
        <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
          {themeQuery.isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-admin-primary" aria-hidden />
          ) : (
            <>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-admin-text">Tamaño y espaciado</h3>
                <p className="mb-2 text-xs text-admin-text-secondary">
                  El fondo exterior y el margen definen el espacio gris alrededor del recuadro de la
                  notificación. Ponga margen exterior en 0 para quitar ese espacio.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <NumberField
                    id="max-w"
                    label="Ancho del bloque (px)"
                    value={draft.containerMaxWidth}
                    min={320}
                    max={720}
                    onChange={(n) => setDraft((d) => ({ ...d, containerMaxWidth: n }))}
                  />
                  <NumberField
                    id="outer-pad"
                    label="Margen exterior / espacio gris (px)"
                    value={draft.outerPadding}
                    min={0}
                    max={48}
                    onChange={(n) => setDraft((d) => ({ ...d, outerPadding: n }))}
                  />
                  <NumberField
                    id="radius"
                    label="Esquinas redondeadas (px)"
                    value={draft.containerRadius}
                    min={0}
                    max={32}
                    onChange={(n) => setDraft((d) => ({ ...d, containerRadius: n }))}
                  />
                  <NumberField
                    id="header-pad"
                    label="Padding encabezado"
                    value={draft.headerPadding}
                    min={0}
                    max={48}
                    onChange={(n) => setDraft((d) => ({ ...d, headerPadding: n }))}
                  />
                  <NumberField
                    id="content-pad"
                    label="Padding contenido"
                    value={draft.contentPadding}
                    min={8}
                    max={64}
                    onChange={(n) => setDraft((d) => ({ ...d, contentPadding: n }))}
                  />
                  <NumberField
                    id="footer-pad"
                    label="Padding pie"
                    value={draft.footerPadding}
                    min={0}
                    max={48}
                    onChange={(n) => setDraft((d) => ({ ...d, footerPadding: n }))}
                  />
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-admin-text">Logo del encabezado</h3>
                <fieldset className="mb-3 space-y-2">
                  <legend className={adminLabel}>Tipo de logo</legend>
                  {(
                    [
                      ['text', 'Texto'],
                      ['image', 'Imagen (URL)'],
                      ['link', 'Enlace (texto + URL)'],
                    ] as const
                  ).map(([mode, label]) => (
                    <label key={mode} className="flex cursor-pointer items-center gap-2 text-sm text-admin-text">
                      <input
                        type="radio"
                        name="logo-mode"
                        checked={draft.logoMode === mode}
                        onChange={() => setDraft((d) => ({ ...d, logoMode: mode as LogoMode }))}
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="logo-label" className={adminLabel}>
                      {draft.logoMode === 'link'
                        ? 'Texto del enlace'
                        : draft.logoMode === 'image'
                          ? 'Texto alternativo (accesibilidad)'
                          : 'Texto del logo'}
                    </label>
                    <input
                      id="logo-label"
                      type="text"
                      className={`${adminInput} mt-1`}
                      value={draft.logoLabel}
                      onChange={(e) => setDraft((d) => ({ ...d, logoLabel: e.target.value }))}
                      maxLength={32}
                    />
                  </div>
                  {draft.logoMode === 'image' ? (
                    <>
                      <div>
                        <label htmlFor="logo-url" className={adminLabel}>
                          URL de la imagen (https)
                        </label>
                        <input
                          id="logo-url"
                          type="url"
                          className={`${adminInput} mt-1`}
                          placeholder="https://…/logo.png"
                          value={draft.logoImageUrl}
                          onChange={(e) => setDraft((d) => ({ ...d, logoImageUrl: e.target.value }))}
                        />
                      </div>
                      <NumberField
                        id="logo-h"
                        label="Alto de la imagen (px)"
                        value={draft.logoImageHeight}
                        min={24}
                        max={120}
                        onChange={(n) => setDraft((d) => ({ ...d, logoImageHeight: n }))}
                      />
                    </>
                  ) : null}
                  {draft.logoMode === 'link' ? (
                    <div>
                      <label htmlFor="logo-link" className={adminLabel}>
                        URL de destino al hacer clic
                      </label>
                      <input
                        id="logo-link"
                        type="url"
                        className={`${adminInput} mt-1`}
                        placeholder="https://comware.com.ec"
                        value={draft.logoLinkUrl}
                        onChange={(e) => setDraft((d) => ({ ...d, logoLinkUrl: e.target.value }))}
                      />
                    </div>
                  ) : null}
                  {draft.logoMode === 'image' || draft.logoMode === 'text' ? (
                    <div>
                      <label htmlFor="logo-link-opt" className={adminLabel}>
                        URL al hacer clic (opcional)
                      </label>
                      <input
                        id="logo-link-opt"
                        type="url"
                        className={`${adminInput} mt-1`}
                        placeholder="https://…"
                        value={draft.logoLinkUrl}
                        onChange={(e) => setDraft((d) => ({ ...d, logoLinkUrl: e.target.value }))}
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-admin-text">Colores</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {COLOR_FIELDS.map(({ key, label, hint }) => (
                    <div key={key}>
                      <label htmlFor={`color-${key}`} className={adminLabel}>
                        {label}
                      </label>
                      {hint ? (
                        <p className="text-xs text-admin-text-secondary">{hint}</p>
                      ) : null}
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          id={`color-${key}`}
                          type="color"
                          value={draft[key] as string}
                          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                          className="h-9 w-14 cursor-pointer rounded border border-admin-border"
                        />
                        <input
                          type="text"
                          className={`${adminInput} font-mono text-sm`}
                          value={draft[key] as string}
                          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                          maxLength={7}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-admin-text">Pie de página</h3>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="footer-line" className={adminLabel}>
                      Línea simple (si no usa HTML abajo)
                    </label>
                    <input
                      id="footer-line"
                      type="text"
                      className={`${adminInput} mt-1`}
                      value={draft.footerLine}
                      onChange={(e) => setDraft((d) => ({ ...d, footerLine: e.target.value }))}
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <label htmlFor="footer-html" className={adminLabel}>
                      HTML del pie (opcional). Etiquetas: p, a, img, strong, br, ul, li…
                    </label>
                    <textarea
                      id="footer-html"
                      className={`${adminInput} mt-1 min-h-[8rem] font-mono text-xs`}
                      placeholder='<p>Av. Ejemplo 123 · <a href="https://comware.com.ec">comware.com.ec</a></p>'
                      value={draft.footerHtml}
                      onChange={(e) => setDraft((d) => ({ ...d, footerHtml: e.target.value }))}
                    />
                    <p className="mt-1 text-xs text-admin-text-secondary">
                      Si escribe HTML aquí, sustituye la línea simple. El año se puede incluir en su texto.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  className={adminBtnSecondary}
                  disabled={previewMutation.isPending}
                  onClick={() => previewMutation.mutate()}
                >
                  {previewMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                  Vista previa
                </button>
                <button
                  type="button"
                  className={adminBtnPrimary}
                  disabled={saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Save className="h-4 w-4" aria-hidden />
                  )}
                  Guardar plantilla
                </button>
              </div>
            </>
          )}
        </div>
        <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <p className={adminLabel}>Vista previa — igual al correo enviado</p>
          <p className="mt-0.5 text-xs text-admin-text-secondary">
            Incluye fondo exterior, márgenes y bloque del mensaje. Se actualiza al cambiar valores.
          </p>
          <div className="mt-2 overflow-hidden rounded-lg border border-admin-border">
            {previewHtml && !previewMutation.isPending ? (
              <EmailPreviewFrame html={previewHtml} />
            ) : (
              <div className="flex h-32 items-center justify-center gap-2 text-sm text-admin-text-secondary">
                <Loader2 className="h-5 w-5 animate-spin text-admin-primary" aria-hidden />
                Generando vista previa…
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
