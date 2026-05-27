/** Etiquetas en español para rutas Zod de la plantilla de correo. */
export const EMAIL_TEMPLATE_FIELD_LABELS: Record<string, string> = {
  headerBg: 'Color: fondo encabezado',
  footerBg: 'Color: fondo pie',
  accentColor: 'Color: botón / acento',
  titleColor: 'Color: títulos',
  textColor: 'Color: texto del cuerpo',
  bodyBg: 'Color: fondo exterior',
  contentBg: 'Color: fondo del bloque',
  containerRadius: 'Esquinas redondeadas',
  logoMode: 'Tipo de logo',
  logoLabel: 'Logo: texto',
  logoImageUrl: 'Logo: URL de imagen',
  logoLinkUrl: 'Logo: URL de enlace',
  logoImageHeight: 'Logo: alto de imagen',
  containerMaxWidth: 'Ancho del correo',
  outerPadding: 'Margen exterior',
  headerPadding: 'Padding encabezado',
  contentPadding: 'Padding contenido',
  footerPadding: 'Padding pie',
  footerLine: 'Pie: línea simple',
  footerHtml: 'Pie: HTML personalizado',
};

export function emailTemplateFieldLabel(path: string): string {
  return EMAIL_TEMPLATE_FIELD_LABELS[path] ?? path;
}
