import {
  DEFAULT_EMAIL_TEMPLATE_THEME,
  type EmailTemplateTheme,
  type LogoMode,
} from '@/types/email-template';

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

function inferLogoMode(partial: Partial<EmailTemplateTheme>): LogoMode {
  if (partial.logoMode === 'text' || partial.logoMode === 'image' || partial.logoMode === 'link') {
    return partial.logoMode;
  }
  if (partial.logoImageUrl?.trim()) return 'image';
  if (partial.logoLinkUrl?.trim() && partial.logoLabel?.trim()) return 'link';
  return 'text';
}

/** Combina borrador parcial con valores por defecto (vista previa en admin). */
export function mergeEmailTemplateTheme(partial?: Partial<EmailTemplateTheme> | null): EmailTemplateTheme {
  const d = DEFAULT_EMAIL_TEMPLATE_THEME;
  const p = partial ?? {};
  return {
    headerBg: p.headerBg ?? d.headerBg,
    footerBg: p.footerBg ?? d.footerBg,
    accentColor: p.accentColor ?? d.accentColor,
    titleColor: p.titleColor ?? d.titleColor,
    textColor: p.textColor ?? d.textColor,
    bodyBg: p.bodyBg ?? d.bodyBg,
    contentBg: p.contentBg ?? d.contentBg,
    containerRadius: clamp(Number(p.containerRadius ?? d.containerRadius), 0, 32),
    logoMode: inferLogoMode(p),
    logoLabel: (p.logoLabel ?? d.logoLabel).slice(0, 32),
    logoImageUrl: (p.logoImageUrl ?? d.logoImageUrl).slice(0, 2048),
    logoLinkUrl: (p.logoLinkUrl ?? d.logoLinkUrl).slice(0, 2048),
    logoImageHeight: clamp(Number(p.logoImageHeight ?? d.logoImageHeight), 24, 120),
    containerMaxWidth: clamp(Number(p.containerMaxWidth ?? d.containerMaxWidth), 320, 720),
    outerPadding: clamp(Number(p.outerPadding ?? d.outerPadding), 0, 48),
    headerPadding: clamp(Number(p.headerPadding ?? d.headerPadding), 0, 48),
    contentPadding: clamp(Number(p.contentPadding ?? d.contentPadding), 8, 64),
    footerPadding: clamp(Number(p.footerPadding ?? d.footerPadding), 0, 48),
    footerLine: (p.footerLine ?? d.footerLine).slice(0, 200),
    footerHtml: typeof p.footerHtml === 'string' ? p.footerHtml.slice(0, 8000) : d.footerHtml,
  };
}
