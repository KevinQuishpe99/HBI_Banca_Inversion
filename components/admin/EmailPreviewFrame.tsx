'use client';

import { useEffect, useRef } from 'react';

type Props = {
  html: string;
  title?: string;
};

/**
 * Muestra el HTML del correo tal como se envía, sin fondos extra del panel admin.
 */
export function EmailPreviewFrame({ html, title = 'Vista previa del correo' }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;

    const resize = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        const h = Math.max(
          doc.documentElement.scrollHeight,
          doc.body?.scrollHeight ?? 0,
          120
        );
        iframe.style.height = `${h}px`;
      } catch {
        iframe.style.height = '480px';
      }
    };

    iframe.addEventListener('load', resize);
    resize();
    return () => iframe.removeEventListener('load', resize);
  }, [html]);

  return (
    <iframe
      ref={ref}
      title={title}
      sandbox="allow-same-origin"
      srcDoc={html}
      className="block w-full min-h-[8rem] border-0 bg-transparent"
    />
  );
}
