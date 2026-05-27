'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useCrearOperacionHbi } from '@/hooks/useHbiOperaciones';
import type { TipoServicioHbi } from '@/types/hbi/operacion.types';
import { TIPOS_SERVICIO_LABEL } from '@/types/hbi/operacion.types';

const SERVICIOS: TipoServicioHbi[] = [
  'ANEXO_1_ADMINISTRATIVO',
  'ANEXO_2_GARANTIAS',
  'ANEXO_3_CALCULO',
];

export default function NuevaOperacionPage() {
  const router = useRouter();
  const crear = useCrearOperacionHbi();
  const [nombreCredito, setNombreCredito] = useState('');
  const [deudor, setDeudor] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [servicios, setServicios] = useState<TipoServicioHbi[]>(['ANEXO_1_ADMINISTRATIVO']);

  const toggleServicio = (s: TipoServicioHbi) => {
    setServicios((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (servicios.length === 0) return;
    const op = await crear.mutateAsync({
      nombreCredito,
      deudor: deudor || undefined,
      descripcion: descripcion || undefined,
      serviciosActivos: servicios,
    });
    router.push(`/operaciones/${op.id}`);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/operaciones"
        className="inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al listado
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Nueva operación de crédito</h1>
        <p className="mt-1 text-slate-600">
          Fase 1: registro inicial y paquete contractual por crédito sindicado.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="nombre" className="block text-sm font-medium text-slate-700">
            Nombre del crédito *
          </label>
          <input
            id="nombre"
            required
            value={nombreCredito}
            onChange={(e) => setNombreCredito(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="deudor" className="block text-sm font-medium text-slate-700">
            Deudor
          </label>
          <input
            id="deudor"
            value={deudor}
            onChange={(e) => setDeudor(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="desc" className="block text-sm font-medium text-slate-700">
            Descripción
          </label>
          <textarea
            id="desc"
            rows={3}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Servicios activos (Anexos) *</legend>
          <div className="mt-2 space-y-2">
            {SERVICIOS.map((s) => (
              <label key={s} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={servicios.includes(s)}
                  onChange={() => toggleServicio(s)}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-slate-800">{TIPOS_SERVICIO_LABEL[s]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {crear.error ? (
          <p className="text-sm text-red-600">{crear.error.message}</p>
        ) : null}

        <button
          type="submit"
          disabled={crear.isPending || servicios.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {crear.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          Crear operación (Fase 1)
        </button>
      </form>
    </div>
  );
}
