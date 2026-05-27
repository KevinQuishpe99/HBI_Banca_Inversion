'use client';

import { useEffect, useState } from 'react';
import { Building2, Loader2, Save, UserCircle } from 'lucide-react';
import { useActualizarInfoProyectoHbi } from '@/hooks/useHbiOperaciones';
import type { InfoProyectoHbi, ViabilidadProyectoHbi } from '@/types/hbi/operacion.types';

const VIABILIDAD_LABEL: Record<ViabilidadProyectoHbi, string> = {
  EN_EVALUACION: 'En evaluación',
  VIABLE: 'Viable',
  CONDICIONADO: 'Viable con condiciones',
  NO_VIABLE: 'No viable',
};

const VIABILIDAD_STYLE: Record<ViabilidadProyectoHbi, string> = {
  EN_EVALUACION: 'bg-slate-100 text-slate-700',
  VIABLE: 'bg-emerald-100 text-emerald-800',
  CONDICIONADO: 'bg-amber-100 text-amber-900',
  NO_VIABLE: 'bg-red-100 text-red-800',
};

type Props = {
  operacionId: string;
  infoInicial?: InfoProyectoHbi | null;
};

export function InfoProyectoViabilidadPanel({ operacionId, infoInicial }: Props) {
  const guardar = useActualizarInfoProyectoHbi(operacionId);
  const [form, setForm] = useState<InfoProyectoHbi>({
    responsableNombre: '',
    responsableCargo: '',
    responsableEmail: '',
    responsableTelefono: '',
    sector: '',
    ubicacion: '',
    descripcionProyecto: '',
    viabilidad: 'EN_EVALUACION',
    notasViabilidad: '',
  });

  useEffect(() => {
    if (infoInicial) {
      setForm({
        responsableNombre: infoInicial.responsableNombre ?? '',
        responsableCargo: infoInicial.responsableCargo ?? '',
        responsableEmail: infoInicial.responsableEmail ?? '',
        responsableTelefono: infoInicial.responsableTelefono ?? '',
        sector: infoInicial.sector ?? '',
        ubicacion: infoInicial.ubicacion ?? '',
        descripcionProyecto: infoInicial.descripcionProyecto ?? '',
        viabilidad: infoInicial.viabilidad ?? 'EN_EVALUACION',
        notasViabilidad: infoInicial.notasViabilidad ?? '',
        actualizadoEn: infoInicial.actualizadoEn,
      });
    }
  }, [infoInicial]);

  const set = (campo: keyof InfoProyectoHbi, valor: string) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  return (
    <section className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50/80 to-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-slate-900">
            <Building2 className="h-5 w-5 text-teal-700" />
            Proyecto y viabilidad
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Fase 2 — Registre quién lidera el proyecto, datos clave y dictamen de viabilidad antes de
            consolidar el expediente 360.
          </p>
        </div>
        <span
          className={[
            'rounded-full px-3 py-1 text-xs font-semibold',
            VIABILIDAD_STYLE[form.viabilidad],
          ].join(' ')}
        >
          {VIABILIDAD_LABEL[form.viabilidad]}
        </span>
      </div>

      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await guardar.mutateAsync({
            ...form,
            responsableNombre: form.responsableNombre.trim(),
          });
        }}
      >
        <div className="sm:col-span-2">
          <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase text-teal-800">
            <UserCircle className="h-3.5 w-3.5" />
            Responsable del proyecto
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Nombre *</label>
          <input
            required
            value={form.responsableNombre}
            onChange={(e) => set('responsableNombre', e.target.value)}
            placeholder="Ej. Ing. Ana Torres — PMO"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Cargo</label>
          <input
            value={form.responsableCargo ?? ''}
            onChange={(e) => set('responsableCargo', e.target.value)}
            placeholder="Director de proyecto"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Correo</label>
          <input
            type="email"
            value={form.responsableEmail ?? ''}
            onChange={(e) => set('responsableEmail', e.target.value)}
            placeholder="pmo@proyecto.com"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Teléfono</label>
          <input
            value={form.responsableTelefono ?? ''}
            onChange={(e) => set('responsableTelefono', e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600">Sector</label>
          <input
            value={form.sector ?? ''}
            onChange={(e) => set('sector', e.target.value)}
            placeholder="Infraestructura / transporte"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Ubicación</label>
          <input
            value={form.ubicacion ?? ''}
            onChange={(e) => set('ubicacion', e.target.value)}
            placeholder="Quito — tramo norte"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600">Descripción del proyecto</label>
          <textarea
            rows={3}
            value={form.descripcionProyecto ?? ''}
            onChange={(e) => set('descripcionProyecto', e.target.value)}
            placeholder="Alcance, plazo, fuente de repago, hitos técnicos..."
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600">Dictamen de viabilidad *</label>
          <select
            value={form.viabilidad}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                viabilidad: e.target.value as ViabilidadProyectoHbi,
              }))
            }
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {(Object.keys(VIABILIDAD_LABEL) as ViabilidadProyectoHbi[]).map((v) => (
              <option key={v} value={v}>
                {VIABILIDAD_LABEL[v]}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600">Notas de viabilidad / condiciones</label>
          <textarea
            rows={2}
            value={form.notasViabilidad ?? ''}
            onChange={(e) => set('notasViabilidad', e.target.value)}
            placeholder="Condiciones de comité, riesgos residuales, observaciones de acreedores..."
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        {form.actualizadoEn ? (
          <p className="text-xs text-slate-500 sm:col-span-2">
            Última actualización: {new Date(form.actualizadoEn).toLocaleString('es-CO')}
          </p>
        ) : null}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={guardar.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {guardar.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar ficha de proyecto
          </button>
        </div>
      </form>
    </section>
  );
}
