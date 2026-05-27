import { EmailTemplateService } from '@/services/email-template.service';
import { DEFAULT_EMAIL_TEMPLATE_THEME, type EmailTemplateTheme } from '@/types/email-template';

let cached: EmailTemplateTheme | null = null;

export async function getEmailTemplateTheme(): Promise<EmailTemplateTheme> {
  if (!cached) {
    cached = await EmailTemplateService.getTheme();
  }
  return cached;
}

export function clearEmailTemplateCache(): void {
  cached = null;
}

export async function reloadEmailTemplateTheme(): Promise<EmailTemplateTheme> {
  clearEmailTemplateCache();
  const theme = await EmailTemplateService.getTheme();
  cached = theme;
  return theme;
}

export function getDefaultEmailTemplateTheme(): EmailTemplateTheme {
  return { ...DEFAULT_EMAIL_TEMPLATE_THEME };
}
