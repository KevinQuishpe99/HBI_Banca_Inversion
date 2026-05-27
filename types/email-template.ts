/** Cómo mostrar el logo en el encabezado del correo. */
export type LogoMode = 'text' | 'image' | 'link';

/** Tema visual de correos transaccionales COMWARE (editable en administración). */
export type EmailTemplateTheme = {
  headerBg: string;
  footerBg: string;
  accentColor: string;
  titleColor: string;
  textColor: string;
  /** Fondo alrededor del bloque del correo (zona gris exterior) */
  bodyBg: string;
  /** Fondo del bloque blanco del mensaje */
  contentBg: string;
  /** Radio de esquinas del bloque (px) */
  containerRadius: number;
  /** text = solo texto; image = imagen; link = texto clicable */
  logoMode: LogoMode;
  /** Texto del logo, enlace visible o texto alternativo de la imagen */
  logoLabel: string;
  /** URL de la imagen (modo image) */
  logoImageUrl: string;
  /** URL al hacer clic (modo link, o opcional en image/text) */
  logoLinkUrl: string;
  logoImageHeight: number;
  /** Ancho máximo del bloque del correo (px) */
  containerMaxWidth: number;
  outerPadding: number;
  headerPadding: number;
  contentPadding: number;
  footerPadding: number;
  /** Línea simple del pie (si no usa HTML personalizado) */
  footerLine: string;
  /** HTML opcional del pie (enlaces, texto legal, etc.) */
  footerHtml: string;
};

export const DEFAULT_EMAIL_TEMPLATE_THEME: EmailTemplateTheme = {
  headerBg: '#1a4d4d',
  footerBg: '#1a4d4d',
  accentColor: '#5dd4c3',
  titleColor: '#1a4d4d',
  textColor: '#4b5563',
  bodyBg: '#e8eaed',
  contentBg: '#ffffff',
  containerRadius: 6,
  logoMode: 'text',
  logoLabel: 'COMWARE',
  logoImageUrl: '',
  logoLinkUrl: '',
  logoImageHeight: 44,
  containerMaxWidth: 560,
  outerPadding: 0,
  headerPadding: 16,
  contentPadding: 24,
  footerPadding: 14,
  footerLine: 'Comware — Todos los derechos reservados',
  footerHtml: '',
};
