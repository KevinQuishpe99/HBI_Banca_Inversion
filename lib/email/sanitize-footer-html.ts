/**
 * Sanitiza HTML del pie de correo (solo etiquetas seguras, sin scripts).
 */

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'a',
  'strong',
  'b',
  'em',
  'i',
  'span',
  'div',
  'img',
  'ul',
  'ol',
  'li',
  'h3',
  'h4',
]);

function stripDangerous(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

/** Permite solo etiquetas de la lista; el resto se elimina conservando texto interno. */
export function sanitizeEmailFooterHtml(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  let safe = stripDangerous(trimmed);
  safe = safe.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag: string) => {
    const name = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return '';
    if (name === 'a') {
      return match.replace(/\shref\s*=\s*("|')?(?!https?:|mailto:)[^"'\s>]+/gi, ' href="#"');
    }
    if (name === 'img') {
      return match.replace(/\ssrc\s*=\s*("|')?(?!https?:)[^"'\s>]+/gi, ' src=""');
    }
    return match;
  });

  return safe.slice(0, 8000);
}
