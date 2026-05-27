/**
 * Plantilla COMWARE (HTML + CSS). Personalizable desde administración.
 */

import { sanitizeEmailFooterHtml } from '@/lib/email/sanitize-footer-html';
import type { EmailTemplateTheme } from '@/types/email-template';
import { DEFAULT_EMAIL_TEMPLATE_THEME } from '@/types/email-template';

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttrUrl(url: string): string {
  const t = url.trim();
  if (!/^https?:\/\//i.test(t)) return '';
  return escapeHtml(t);
}

function firstName(displayName: string): string {
  const t = displayName.trim();
  if (!t) return 'Usuario';
  const sp = t.indexOf(' ');
  return sp === -1 ? t : t.slice(0, sp);
}

/** Quita el bloque de pie de texto plano usado en notificaciones. */
export function stripTransactionalFooterPlain(text: string): string {
  const idx = text.indexOf('────────────────────────────────────────');
  if (idx === -1) return text.trim();
  return text.slice(0, idx).trim();
}

function plainBlocksToInnerHtml(strippedPlain: string): string {
  const paragraphs = strippedPlain.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  return paragraphs
    .map((p) => {
      const escaped = escapeHtml(p).replace(/\n/g, '<br/>');
      return `<p>${escaped}</p>`;
    })
    .join('');
}

function resolveTheme(theme?: EmailTemplateTheme): EmailTemplateTheme {
  return theme ?? DEFAULT_EMAIL_TEMPLATE_THEME;
}

function wrapWithOptionalLink(inner: string, linkUrl: string): string {
  const href = escapeAttrUrl(linkUrl);
  if (!href) return inner;
  return `<a href="${href}" class="logo-link" style="text-decoration:none;color:inherit;">${inner}</a>`;
}

function buildHeaderHtml(t: EmailTemplateTheme): string {
  const mode = t.logoMode;
  const label = escapeHtml(t.logoLabel.trim() || 'COMWARE');
  const clickUrl = t.logoLinkUrl.trim();

  if (mode === 'image') {
    const src = escapeAttrUrl(t.logoImageUrl.trim());
    if (!src) {
      return `<div class="logo-text">${label}</div>`;
    }
    const img = `<img src="${src}" alt="${label}" class="logo-img" style="max-height:${t.logoImageHeight}px;width:auto;display:block;border:0;" />`;
    return wrapWithOptionalLink(img, clickUrl);
  }

  if (mode === 'link') {
    const href = escapeAttrUrl(clickUrl);
    if (!href) {
      return `<div class="logo-text">${label}</div>`;
    }
    return `<a href="${href}" class="logo-link" style="color:#ffffff;font-weight:bold;font-size:14px;text-decoration:underline;">${label}</a>`;
  }

  const text = `<div class="logo-text">${label}</div>`;
  return wrapWithOptionalLink(text, clickUrl);
}

function buildFooterInnerHtml(t: EmailTemplateTheme): string {
  const custom = sanitizeEmailFooterHtml(t.footerHtml);
  if (custom) {
    return `<div class="footer-custom">${custom}</div>`;
  }
  const year = new Date().getFullYear();
  return `<p class="footer-line">${year} ${escapeHtml(t.footerLine)}</p>`;
}

function comwareEmailStyles(theme: EmailTemplateTheme): string {
  const t = resolveTheme(theme);
  return `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        height: auto;
        min-height: 0;
      }
      body {
        padding: ${t.outerPadding}px;
        background-color: ${t.bodyBg};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      }
      .container {
        max-width: ${t.containerMaxWidth}px;
        width: 100%;
        margin: 0 auto;
        background: ${t.contentBg};
        border-radius: ${t.containerRadius}px;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      }
      .header {
        background-color: ${t.headerBg};
        padding: ${t.headerPadding}px ${t.contentPadding}px;
      }
      .logo-text {
        display: inline-block;
        font-weight: bold;
        font-size: 14px;
        color: #ffffff;
        letter-spacing: 0.05em;
      }
      .logo-img { border: 0; outline: none; }
      a.logo-link { color: #ffffff; }
      a.logo-link:hover { opacity: 0.9; }
      .content { padding: ${t.contentPadding}px; background: ${t.contentBg}; }
      .content h1 {
        font-size: 22px;
        font-weight: bold;
        color: ${t.titleColor};
        margin-bottom: 16px;
      }
      .content p {
        font-size: 14px;
        color: ${t.textColor};
        line-height: 1.55;
        margin-bottom: 12px;
      }
      .content .label { font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 10px; }
      .credentials { margin-bottom: 20px; font-size: 14px; }
      .credentials p { margin-bottom: 6px; color: ${t.textColor}; }
      .link-text { color: #6b7280; font-size: 14px; margin-bottom: 16px; }
      .link-text a { color: ${t.titleColor}; word-break: break-all; }
      a.cta-button {
        display: inline-block;
        background-color: ${t.accentColor};
        color: #ffffff !important;
        font-weight: 600;
        padding: 10px 24px;
        border-radius: 6px;
        font-size: 14px;
        margin-bottom: 20px;
        text-decoration: none;
      }
      .disclaimer { font-size: 12px; color: #6b7280; line-height: 1.5; margin-bottom: 16px; }
      .signature { font-size: 14px; color: ${t.textColor}; }
      .footer {
        background-color: ${t.footerBg};
        padding: ${t.footerPadding}px ${t.contentPadding}px;
        text-align: center;
      }
      .footer-line { font-size: 12px; color: #d1d5db; margin: 0; }
      .footer-custom { font-size: 12px; color: #e5e7eb; line-height: 1.5; }
      .footer-custom a { color: #ffffff; text-decoration: underline; }
      .footer-custom img { max-width: 100%; height: auto; }
`;
}

/**
 * Envuelve el HTML interno (solo lo que iría dentro de .content).
 */
export function wrapComwareEmail(contentInnerHtml: string, theme?: EmailTemplateTheme): string {
  const t = resolveTheme(theme);
  const title = escapeHtml(t.logoLabel || 'COMWARE');
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>${comwareEmailStyles(t)}</style>
  </head>
  <body style="margin:0;padding:${t.outerPadding}px;background-color:${t.bodyBg};min-height:0;">
    <div class="container" style="max-width:${t.containerMaxWidth}px;background:${t.contentBg};border-radius:${t.containerRadius}px;">
      <div class="header" style="background-color:${t.headerBg};padding:${t.headerPadding}px ${t.contentPadding}px;">
        ${buildHeaderHtml(t)}
      </div>
      <div class="content" style="padding:${t.contentPadding}px;">${contentInnerHtml}</div>
      <div class="footer" style="background-color:${t.footerBg};padding:${t.footerPadding}px ${t.contentPadding}px;">
        ${buildFooterInnerHtml(t)}
      </div>
    </div>
  </body>
</html>`;
}

export function buildNotificationHtmlFromPlainBody(
  bodyText: string,
  theme?: EmailTemplateTheme
): string {
  const inner = plainBlocksToInnerHtml(stripTransactionalFooterPlain(bodyText));
  return wrapComwareEmail(inner, theme);
}

export function buildSamplePreviewHtml(theme: EmailTemplateTheme, sampleMessage?: string): string {
  const msg =
    sampleMessage?.trim() ||
    'Este es un ejemplo de cómo se verán los comunicados y notificaciones del sistema.';
  const body = ['Estimado/a Usuario,', '', msg, '', 'Equipo Comware'].join('\n');
  return buildNotificationHtmlFromPlainBody(body, theme);
}

export function buildCredentialsEmailHtml(params: {
  displayName: string;
  email: string;
  plainPassword: string;
  loginUrl: string;
  kind: 'registration' | 'admin_created';
  theme?: EmailTemplateTheme;
}): string {
  const { displayName, email, plainPassword, loginUrl, kind } = params;
  const t = resolveTheme(params.theme);
  const name = escapeHtml(firstName(displayName));
  const emailEsc = escapeHtml(email);
  const passEsc = escapeHtml(plainPassword);
  const hasLogin = Boolean(loginUrl.trim());
  const urlEsc = escapeHtml(hasLogin ? loginUrl : '#');

  const intro =
    'Confirmamos que su usuario en el Sistema Documental Comware ha sido creado con éxito.';

  const disclaimer =
    kind === 'admin_created'
      ? 'Si no autorizó este registro, ignore este mensaje y notifíquelo a su administrador.'
      : 'Si no solicitó este registro, ignore este mensaje y notifíquelo a su administrador.';

  const linkAndCta = hasLogin
    ? `
        <p>Puede ingresar al sistema a través de este enlace o haciendo clic en el botón a continuación.</p>
        <p class="link-text"><a href="${urlEsc}">${urlEsc}</a></p>
        <a class="cta-button" href="${urlEsc}" style="background-color:${t.accentColor};">Ingresa aquí</a>`
    : `<p>Solicite a su administrador la dirección de acceso al sistema.</p>`;

  const inner = `
        <h1 style="color:${t.titleColor};">Bienvenido, ${name}</h1>
        <p style="color:${t.textColor};">${escapeHtml(intro)}</p>
        <p class="label">Ingrese con los siguientes datos:</p>
        <div class="credentials">
          <p><strong>Usuario:</strong> ${emailEsc}</p>
          <p><strong>Contraseña:</strong> ${passEsc}</p>
        </div>
        ${linkAndCta}
        <p class="disclaimer">${escapeHtml(disclaimer)}</p>
        <p class="signature">Equipo Comware</p>`;

  return wrapComwareEmail(inner, t);
}
