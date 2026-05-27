'use client';

import { useState } from 'react';
import { usaDatosQuemadosHbi } from '@/lib/hbi/mock-config';
import { MockHbiStore } from '@/lib/hbi/mock-store';
import { getPersistedSavedAt } from '@/lib/hbi/mock-persistence';
import { useQueryClient } from '@tanstack/react-query';
import { Database, RotateCcw } from 'lucide-react';

export function MockModeBanner() {
  const qc = useQueryClient();
  const [savedAt, setSavedAt] = useState<string | null>(() =>
    typeof window !== 'undefined' ? getPersistedSavedAt() : null
  );

  if (!usaDatosQuemadosHbi()) return null;

  const reiniciar = () => {
    if (!window.confirm('¿Restaurar datos de ejemplo? Se perderán los cambios del demo.')) return;
    MockHbiStore.reset();
    setSavedAt(null);
    qc.invalidateQueries();
  };

  return (
    <div
      className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-start sm:justify-between"
      role="status"
    >
      <div className="flex items-start gap-3">
        <Database className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div>
          <p className="font-semibold">Modo demostración — sin base de datos</p>
          <p className="mt-0.5 text-amber-900/90">
            Operaciones, documentos, correos y trazabilidad se guardan en la caché del navegador
            (localStorage){savedAt ? ` · última actualización: ${new Date(savedAt).toLocaleString('es-CO')}` : ''}.
            Login con usuarios de prueba en la pantalla de acceso.{' '}
            <a href="/#guia-demo-hbi" className="font-medium underline hover:text-amber-950">
              Ver guía completa
            </a>
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={reiniciar}
        className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Restaurar demo
      </button>
    </div>
  );
}
