import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/get-session';
import { clearEmailTemplateCache } from '@/lib/email/template-cache';
import { mergeEmailTemplateTheme } from '@/lib/email/merge-email-theme';
import { buildSamplePreviewHtml } from '@/lib/email/transactional-html';
import { EmailTemplateService } from '@/services/email-template.service';
import { successResponse, errorResponse } from '@/lib/utils/response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use color en formato #RRGGBB');
const px = z.coerce.number().int();

const logoModeSchema = z.enum(['text', 'image', 'link']);

const themeSchema = z.object({
  headerBg: hexColor,
  footerBg: hexColor,
  accentColor: hexColor,
  titleColor: hexColor,
  textColor: hexColor,
  bodyBg: hexColor,
  contentBg: hexColor,
  containerRadius: px.min(0).max(32),
  logoMode: logoModeSchema,
  logoLabel: z.string().max(32),
  logoImageUrl: z.string().max(2048),
  logoLinkUrl: z.string().max(2048),
  logoImageHeight: px.min(24).max(120),
  containerMaxWidth: px.min(320).max(720),
  outerPadding: px.min(0).max(48),
  headerPadding: px.min(0).max(48),
  contentPadding: px.min(8).max(64),
  footerPadding: px.min(0).max(48),
  footerLine: z.string().max(200),
  footerHtml: z.string().max(8000),
});

const previewThemeSchema = themeSchema.partial();

const previewSchema = z.object({
  theme: previewThemeSchema.optional(),
  sampleMessage: z.string().max(2000).optional(),
});

/** GET /api/admin/email-template */
export async function GET() {
  try {
    await requireRole('ADMIN');
    const theme = await EmailTemplateService.getTheme();
    return successResponse({ theme });
  } catch (e) {
    return errorResponse(e);
  }
}

/** PUT /api/admin/email-template */
export async function PUT(request: NextRequest) {
  try {
    await requireRole('ADMIN');
    const json = await request.json();
    const merged = mergeEmailTemplateTheme(
      (json as { theme?: Record<string, unknown> }).theme ?? json
    );
    const saved = await EmailTemplateService.setTheme(merged);
    clearEmailTemplateCache();
    return successResponse({ theme: saved, message: 'Plantilla de correo guardada.' });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/admin/email-template — vista previa HTML */
export async function POST(request: NextRequest) {
  try {
    await requireRole('ADMIN');
    const json = await request.json();
    const body = previewSchema.parse(json);
    const themeForPreview = body.theme
      ? mergeEmailTemplateTheme(body.theme)
      : await EmailTemplateService.getTheme();
    const html = buildSamplePreviewHtml(themeForPreview, body.sampleMessage);
    return successResponse({ html, theme: themeForPreview });
  } catch (e) {
    return errorResponse(e);
  }
}
