import { sanitizeEmailFooterHtml } from '@/lib/email/sanitize-footer-html';
import type { EmailTemplateTheme, LogoMode } from '@/types/email-template';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const LOGO_URL = /^https?:\/\/.+/i;

const COLOR_LABELS: Partial<Record<keyof EmailTemplateTheme, string>> = {
  headerBg: 'Fondo encabezado',
  footerBg: 'Fondo pie',
  accentColor: 'Botón / acento',
  titleColor: 'Títulos',
  textColor: 'Texto del cuerpo',
  bodyBg: 'Fondo exterior',
  contentBg: 'Fondo del bloque',
};

/** Lista campos obligatorios o inválidos (español) para mostrar en admin. */
export function getEmailTemplateValidationErrors(theme: EmailTemplateTheme): string[] {
  const errors: string[] = [];

  const colorKeys = Object.keys(COLOR_LABELS) as (keyof EmailTemplateTheme)[];
  for (const key of colorKeys) {
    const v = theme[key];
    if (typeof v !== 'string' || !HEX_COLOR.test(v)) {
      errors.push(`${COLOR_LABELS[key] ?? String(key)}: use formato #RRGGBB`);
    }
  }

  const logoImageUrl = theme.logoImageUrl.trim();
  const logoLinkUrl = theme.logoLinkUrl.trim();
  if (logoImageUrl && !LOGO_URL.test(logoImageUrl)) {
    errors.push('Logo: la URL de la imagen debe empezar con http:// o https://');
  }
  if (logoLinkUrl && !LOGO_URL.test(logoLinkUrl)) {
    errors.push('Logo: la URL de destino debe empezar con http:// o https://');
  }

  const mode: LogoMode = theme.logoMode;
  if (mode === 'image') {
    if (!logoImageUrl) errors.push('Logo: URL de la imagen (modo Imagen)');
  } else if (mode === 'link') {
    if (!theme.logoLabel.trim()) errors.push('Logo: texto del enlace (modo Enlace)');
    if (!logoLinkUrl) errors.push('Logo: URL de destino al hacer clic (modo Enlace)');
  } else if (!theme.logoLabel.trim()) {
    errors.push('Logo: texto del logo (modo Texto)');
  }

  const footerHtml = sanitizeEmailFooterHtml(theme.footerHtml);
  const footerLine = theme.footerLine.trim();
  if (!footerHtml && !footerLine) {
    errors.push('Pie de página: línea simple o HTML del pie');
  }

  return errors;
}

export function formatEmailTemplateValidationMessage(errors: string[]): string {
  return `Faltan datos obligatorios:\n• ${errors.join('\n• ')}`;
}
