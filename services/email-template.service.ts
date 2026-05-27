import { query } from '@/lib/db';
import { sanitizeEmailFooterHtml } from '@/lib/email/sanitize-footer-html';
import { mergeEmailTemplateTheme } from '@/lib/email/merge-email-theme';
import {
  formatEmailTemplateValidationMessage,
  getEmailTemplateValidationErrors,
} from '@/lib/email/validate-email-template-theme';
import {
  DEFAULT_EMAIL_TEMPLATE_THEME,
  type EmailTemplateTheme,
  type LogoMode,
} from '@/types/email-template';
import { clearEmailTemplateCache } from '@/lib/email/template-cache';
import { ValidationError } from '@/lib/utils/errors';

const SETTINGS_KEY = 'email_template_theme';

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

function parseThemeJson(raw: string | null | undefined): EmailTemplateTheme {
  if (!raw?.trim()) return { ...DEFAULT_EMAIL_TEMPLATE_THEME };
  try {
    const parsed = JSON.parse(raw) as Partial<EmailTemplateTheme>;
    return mergeEmailTemplateTheme(parsed);
  } catch {
    return { ...DEFAULT_EMAIL_TEMPLATE_THEME };
  }
}

function validateTheme(theme: EmailTemplateTheme): EmailTemplateTheme {
  const faltantes = getEmailTemplateValidationErrors(theme);
  if (faltantes.length > 0) {
    throw new ValidationError(formatEmailTemplateValidationMessage(faltantes));
  }

  const logoImageUrl = theme.logoImageUrl.trim();
  const logoLinkUrl = theme.logoLinkUrl.trim();
  const mode: LogoMode = theme.logoMode;
  const footerHtml = sanitizeEmailFooterHtml(theme.footerHtml);
  const footerLine = theme.footerLine.trim();

  return {
    headerBg: theme.headerBg.toLowerCase(),
    footerBg: theme.footerBg.toLowerCase(),
    accentColor: theme.accentColor.toLowerCase(),
    titleColor: theme.titleColor.toLowerCase(),
    textColor: theme.textColor.toLowerCase(),
    bodyBg: theme.bodyBg.toLowerCase(),
    contentBg: theme.contentBg.toLowerCase(),
    containerRadius: clamp(theme.containerRadius, 0, 32),
    logoMode: mode,
    logoLabel: theme.logoLabel.trim() || 'COMWARE',
    logoImageUrl: logoImageUrl,
    logoLinkUrl: logoLinkUrl,
    logoImageHeight: clamp(theme.logoImageHeight, 24, 120),
    containerMaxWidth: clamp(theme.containerMaxWidth, 320, 720),
    outerPadding: clamp(theme.outerPadding, 0, 48),
    headerPadding: clamp(theme.headerPadding, 0, 48),
    contentPadding: clamp(theme.contentPadding, 8, 64),
    footerPadding: clamp(theme.footerPadding, 0, 48),
    footerLine,
    footerHtml,
  };
}

export class EmailTemplateService {
  static async getTheme(): Promise<EmailTemplateTheme> {
    try {
      const r = await query<{ valor_texto: string | null }>(
        `SELECT valor_texto FROM configuracion_app WHERE clave = $1`,
        [SETTINGS_KEY]
      );
      return parseThemeJson(r.rows[0]?.valor_texto);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('valor_texto') && msg.includes('does not exist')) {
        return { ...DEFAULT_EMAIL_TEMPLATE_THEME };
      }
      throw e;
    }
  }

  static async setTheme(theme: EmailTemplateTheme): Promise<EmailTemplateTheme> {
    const valid = validateTheme(theme);
    const json = JSON.stringify(valid);
    try {
      await query(
        `INSERT INTO configuracion_app (clave, valor_texto, actualizado_en)
         VALUES ($1, $2, NOW())
         ON CONFLICT (clave) DO UPDATE
           SET valor_texto = EXCLUDED.valor_texto, actualizado_en = NOW()`,
        [SETTINGS_KEY, json]
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('valor_texto') && msg.includes('does not exist')) {
        throw new ValidationError(
          'La base de datos aún no admite guardar la plantilla. Ejecute la migración de correos en el servidor.'
        );
      }
      throw e;
    }
    clearEmailTemplateCache();
    return valid;
  }
}
