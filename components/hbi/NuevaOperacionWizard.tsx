'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  FileText,
  Landmark,
  Loader2,
  Plus,
  Shield,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import { useCrearOperacionHbi } from '@/hooks/useHbiOperaciones';
import { listarAcreedores, listarDeudores } from '@/lib/hbi/catalogo-clientes';
import { GUIA_FASES_WORKFLOW } from '@/lib/hbi/anexos-guia';
import {
  actualizarChecklistHitosPorServicios,
  formatearMonto,
  fechaInputDesdeIso,
  generarHitosPorCantidad,
  isoDesdeFechaInput,
  recalcularMontosHitos,
  repartirPorcentajes,
} from '@/lib/hbi/hitos-plantilla';
import { DesembolsosEvidenciaPanel } from '@/components/hbi/DesembolsosEvidenciaPanel';
import {
  SERVICIOS_HBI_TODOS,
  ServiciosHbiContratacion,
} from '@/components/hbi/ServiciosHbiContratacion';
import { FASES_PROYECTO_HBI } from '@/lib/hbi/desembolsos-domain';
import type { HitoDesembolsoHbi, ParticipacionAcreedor, TipoCreditoHbi } from '@/types/hbi/cliente.types';
import { TIPO_CREDITO_LABEL } from '@/types/hbi/cliente.types';
import type { TipoServicioHbi } from '@/types/hbi/operacion.types';
import { AGENTE_FINANCIACION_HBI, TIPOS_SERVICIO_LABEL } from '@/types/hbi/operacion.types';

const PASOS = [
  { id: 1, titulo: 'Crédito', icon: FileText },
  { id: 2, titulo: 'Partes', icon: Users },
  { id: 3, titulo: 'Montos y fases', icon: Wallet },
  { id: 4, titulo: 'Servicios HBI', icon: Shield },
  { id: 5, titulo: 'Resumen', icon: Check },
] as const;

export function NuevaOperacionWizard() {
  const router = useRouter();
  const crear = useCrearOperacionHbi();
  const deudores = listarDeudores();
  const acreedoresCatalogo = listarAcreedores();

  const [paso, setPaso] = useState(1);
  const [nombreCredito, setNombreCredito] = useState('');
  const [tipoCredito, setTipoCredito] = useState<TipoCreditoHbi>('PROJECT_FINANCE');
  const [descripcion, setDescripcion] = useState('');
  const [deudorId, setDeudorId] = useState(deudores[0]?.id ?? '');
  const [acreedores, setAcreedores] = useState<ParticipacionAcreedor[]>([]);
  const [montoTotal, setMontoTotal] = useState(150_000_000);
  const [moneda, setMoneda] = useState<'USD' | 'COP'>('USD');
  const [servicios, setServicios] = useState<TipoServicioHbi[]>([
    'ANEXO_1_ADMINISTRATIVO',
    'ANEXO_2_GARANTIAS',
    'ANEXO_3_CALCULO',
  ]);
  const [cantidadDesembolsos, setCantidadDesembolsos] = useState(4);
  const [hitos, setHitos] = useState<HitoDesembolsoHbi[]>(() =>
    generarHitosPorCantidad(4, 150_000_000, servicios)
  );
  const [anexoExpandido, setAnexoExpandido] = useState<TipoServicioHbi | null>(
    'ANEXO_1_ADMINISTRATIVO'
  );
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const deudorSel = deudores.find((d) => d.id === deudorId);
  const porcentajeAcreedores = acreedores.reduce((s, a) => s + a.porcentaje, 0);
  const porcentajeHitos = hitos.reduce((s, h) => s + h.porcentaje, 0);

  const montoAprobadoTotal = useMemo(
    () => hitos.filter((h) => h.aprobado).reduce((s, h) => s + h.montoAprobado, 0),
    [hitos]
  );

  const actualizarMontoTotal = (valor: number) => {
    setMontoTotal(valor);
    setHitos((prev) => recalcularMontosHitos(prev, valor));
    setAcreedores((prev) =>
      prev.map((a) => ({
        ...a,
        montoComprometido: Math.round((valor * a.porcentaje) / 100),
      }))
    );
  };

  const agregarAcreedor = (id: string) => {
    if (acreedores.some((a) => a.id === id)) return;
    const cli = acreedoresCatalogo.find((c) => c.id === id);
    if (!cli) return;
    const restante = Math.max(0, 100 - porcentajeAcreedores);
    const pct = restante >= 25 ? 25 : restante;
    if (pct <= 0) return;
    setAcreedores((prev) => [
      ...prev,
      {
        id: cli.id,
        razonSocial: cli.razonSocial,
        porcentaje: pct,
        montoComprometido: Math.round((montoTotal * pct) / 100),
      },
    ]);
  };

  const quitarAcreedor = (id: string) => {
    setAcreedores((prev) => prev.filter((a) => a.id !== id));
  };

  const actualizarParticipacion = (id: string, porcentaje: number) => {
    setAcreedores((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              porcentaje,
              montoComprometido: Math.round((montoTotal * porcentaje) / 100),
            }
          : a
      )
    );
  };

  const toggleAprobacionHito = (id: string, aprobado: boolean) => {
    setHitos((prev) =>
      prev.map((h) =>
        h.id === id
          ? {
              ...h,
              aprobado,
              montoAprobado: aprobado ? h.monto : 0,
              estado: aprobado ? 'APROBADO' : 'PENDIENTE_APROBACION',
            }
          : h
      )
    );
  };

  const actualizarMontoAprobadoHito = (id: string, montoAprobado: number) => {
    setHitos((prev) =>
      prev.map((h) => (h.id === id ? { ...h, montoAprobado, aprobado: montoAprobado > 0 } : h))
    );
  };

  const toggleServicio = (s: TipoServicioHbi) => {
    setServicios((prev) => {
      const next = prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s];
      if (next.length === 0) return prev;
      setHitos((prevHitos) => actualizarChecklistHitosPorServicios(prevHitos, next));
      return next;
    });
  };

  const seleccionarTodosServicios = () => {
    setServicios(SERVICIOS_HBI_TODOS);
    setHitos((prevHitos) => actualizarChecklistHitosPorServicios(prevHitos, SERVICIOS_HBI_TODOS));
  };

  const cambiarCantidadDesembolsos = (n: number) => {
    setCantidadDesembolsos(n);
    setHitos(generarHitosPorCantidad(n, montoTotal, servicios));
  };

  const repartirEquitativamente = () => {
    const pct = repartirPorcentajes(cantidadDesembolsos);
    setHitos((prev) =>
      recalcularMontosHitos(
        prev.map((h, i) => ({ ...h, porcentaje: pct[i] ?? h.porcentaje })),
        montoTotal
      )
    );
  };

  const actualizarCampoHito = (
    id: string,
    campo: 'nombre' | 'porcentaje' | 'fechaObjetivo' | 'descripcionFase' | 'faseProyecto',
    valor: string | number
  ) => {
    setHitos((prev) => {
      const next = prev.map((h) => {
        if (h.id !== id) return h;
        if (campo === 'nombre') return { ...h, nombre: String(valor) };
        if (campo === 'descripcionFase') return { ...h, descripcionFase: String(valor) };
        if (campo === 'faseProyecto') return { ...h, faseProyecto: String(valor) };
        if (campo === 'porcentaje') return { ...h, porcentaje: Number(valor) || 0 };
        return { ...h, fechaObjetivo: isoDesdeFechaInput(String(valor)) };
      });
      return campo === 'porcentaje' ? recalcularMontosHitos(next, montoTotal) : next;
    });
  };

  const validarPaso = (n: number): string | null => {
    if (n === 1 && nombreCredito.trim().length < 3) {
      return 'Indique un nombre de crédito (mínimo 3 caracteres).';
    }
    if (n === 2 && !deudorId) return 'Seleccione el deudor (cliente que recibe el préstamo).';
    if (n === 2 && acreedores.length === 0) {
      return 'Agregue al menos un acreedor al sindicato.';
    }
    if (n === 2 && porcentajeAcreedores !== 100) {
      return `La participación de acreedores debe sumar 100% (actual: ${porcentajeAcreedores}%).`;
    }
    if (n === 3 && montoTotal <= 0) return 'El monto total debe ser mayor a cero.';
    if (n === 3 && porcentajeHitos !== 100) {
      return `Los hitos deben sumar 100% del monto (actual: ${porcentajeHitos}%).`;
    }
    if (n === 4 && servicios.length === 0) return 'Seleccione al menos un Anexo HBI.';
    return null;
  };

  const irSiguiente = () => {
    const err = validarPaso(paso);
    if (err) {
      setErrorForm(err);
      return;
    }
    setErrorForm(null);
    setPaso((p) => Math.min(5, p + 1));
  };

  const onSubmit = async () => {
    for (let i = 1; i <= 4; i += 1) {
      const err = validarPaso(i);
      if (err) {
        setErrorForm(err);
        setPaso(i);
        return;
      }
    }
    if (!deudorSel) return;

    const op = await crear.mutateAsync({
      nombreCredito: nombreCredito.trim(),
      descripcion: descripcion.trim() || undefined,
      deudor: deudorSel.razonSocial,
      deudorId: deudorSel.id,
      tipoCredito,
      serviciosActivos: servicios,
      estructuraFinanciera: {
        montoTotal,
        moneda,
        acreedores,
        montoComprometidoTotal: acreedores.reduce((s, a) => s + a.montoComprometido, 0),
      },
      hitosDesembolso: hitos,
    });
    router.push(`/operaciones/${op.id}`);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/operaciones"
        className="inline-flex items-center gap-2 text-sm text-[var(--color-brand-primary)] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al listado
      </Link>

      <header className="rounded-xl border border-[var(--color-brand-border)] bg-gradient-to-br from-white to-[var(--color-brand-accent)]/40 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <Landmark className="mt-0.5 h-8 w-8 text-[var(--color-brand-primary)]" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Nueva operación de crédito sindicado</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              {AGENTE_FINANCIACION_HBI}: configure deudor, sindicato de acreedores, plan de
              desembolsos por fases del proyecto y los tres servicios posibles — Agente Administrativo,
              de Garantías y de Cálculo (Anexos 1, 2 y 3).
            </p>
          </div>
        </div>

        <nav className="mt-6 flex flex-wrap gap-2" aria-label="Pasos del formulario">
          {PASOS.map((p) => {
            const Icon = p.icon;
            const activo = paso === p.id;
            const listo = paso > p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => p.id < paso && setPaso(p.id)}
                className={[
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
                  activo
                    ? 'bg-[var(--color-brand-primary)] text-white shadow'
                    : listo
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-white text-slate-600 ring-1 ring-slate-200',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" />
                {p.titulo}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {paso === 1 ? (
          <section className="space-y-5">
            <h2 className="text-lg font-semibold text-slate-900">1 · Identificación del crédito</h2>
            <div>
              <label htmlFor="nombre" className="block text-sm font-medium text-slate-700">
                Nombre del crédito *
              </label>
              <input
                id="nombre"
                value={nombreCredito}
                onChange={(e) => setNombreCredito(e.target.value)}
                placeholder="Ej. Project Finance Línea Solar Norte"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/20"
              />
            </div>
            <div>
              <label htmlFor="tipo" className="block text-sm font-medium text-slate-700">
                Tipo de operación
              </label>
              <select
                id="tipo"
                value={tipoCredito}
                onChange={(e) => setTipoCredito(e.target.value as TipoCreditoHbi)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
              >
                {(Object.keys(TIPO_CREDITO_LABEL) as TipoCreditoHbi[]).map((k) => (
                  <option key={k} value={k}>
                    {TIPO_CREDITO_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="desc" className="block text-sm font-medium text-slate-700">
                Descripción / objeto del financiamiento
              </label>
              <textarea
                id="desc"
                rows={3}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Breve descripción del proyecto o uso de fondos..."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
              />
            </div>
            <aside className="rounded-lg border border-blue-100 bg-blue-50/60 p-4 text-sm text-slate-700">
              <p className="font-medium text-slate-900">¿Cómo funciona el workflow HBI?</p>
              <ol className="mt-2 space-y-2">
                {GUIA_FASES_WORKFLOW.map((f) => (
                  <li key={f.fase}>
                    <span className="font-semibold text-[var(--color-brand-primary)]">
                      Fase {f.fase}:
                    </span>{' '}
                    {f.titulo} — {f.texto}
                  </li>
                ))}
              </ol>
            </aside>
          </section>
        ) : null}

        {paso === 2 ? (
          <section className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">2 · Partes de la operación</h2>

            <div>
              <label htmlFor="deudor" className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Building2 className="h-4 w-4" />
                Deudor (recibe el préstamo) *
              </label>
              <select
                id="deudor"
                value={deudorId}
                onChange={(e) => setDeudorId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
              >
                {deudores.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.razonSocial} — {d.sector} ({d.pais})
                  </option>
                ))}
              </select>
              {deudorSel ? (
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  NIT {deudorSel.nit} · Contacto: {deudorSel.contacto} ({deudorSel.email})
                </p>
              ) : null}
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Users className="h-4 w-4" />
                  Acreedores del sindicado (prestan el dinero) *
                </p>
                <span
                  className={[
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    porcentajeAcreedores === 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800',
                  ].join(' ')}
                >
                  Participación: {porcentajeAcreedores}% / 100%
                </span>
              </div>

              <div className="mt-3 space-y-3">
                {acreedores.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">{a.razonSocial}</p>
                      <p className="text-xs text-slate-500">
                        Compromiso: {formatearMonto(a.montoComprometido, moneda)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={a.porcentaje}
                        onChange={(e) =>
                          actualizarParticipacion(a.id, Number(e.target.value) || 0)
                        }
                        className="w-16 rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                      <span className="text-sm text-slate-600">%</span>
                      <button
                        type="button"
                        onClick={() => quitarAcreedor(a.id)}
                        className="rounded p-1 text-red-600 hover:bg-red-50"
                        aria-label="Quitar acreedor"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {acreedoresCatalogo
                  .filter((c) => !acreedores.some((a) => a.id === c.id))
                  .slice(0, 6)
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => agregarAcreedor(c.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {c.razonSocial.split(' ').slice(0, 2).join(' ')}
                    </button>
                  ))}
              </div>
            </div>
          </section>
        ) : null}

        {paso === 3 ? (
          <section className="space-y-5">
            <h2 className="text-lg font-semibold text-slate-900">
              3 · Monto total y plan de desembolsos
            </h2>
            <p className="text-sm text-slate-600">
              Indique cuántos desembolsos tendrá el proyecto, qué porcentaje del crédito corresponde
              a cada fase y en qué fecha está programado. La evidencia quedará visible en el
              expediente de la operación.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="monto" className="block text-sm font-medium text-slate-700">
                  Monto total aprobado *
                </label>
                <input
                  id="monto"
                  type="number"
                  min={100000}
                  step={100000}
                  value={montoTotal}
                  onChange={(e) => actualizarMontoTotal(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono"
                />
              </div>
              <div>
                <label htmlFor="moneda" className="block text-sm font-medium text-slate-700">
                  Moneda
                </label>
                <select
                  id="moneda"
                  value={moneda}
                  onChange={(e) => setMoneda(e.target.value as 'USD' | 'COP')}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                >
                  <option value="USD">USD — Dólar</option>
                  <option value="COP">COP — Peso colombiano</option>
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
              <label htmlFor="cantidad" className="block text-sm font-semibold text-slate-800">
                ¿Cuántos desembolsos tendrá este proyecto? *
              </label>
              <p className="mt-0.5 text-xs text-slate-600">
                Típico en project finance: 2 a 8 desembolsos ligados a hitos de obra o operación.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <select
                  id="cantidad"
                  value={cantidadDesembolsos}
                  onChange={(e) => cambiarCantidadDesembolsos(Number(e.target.value))}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-lg font-semibold text-indigo-800"
                >
                  {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n} desembolsos
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={repartirEquitativamente}
                  className="rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm font-medium text-indigo-800 hover:bg-indigo-50"
                >
                  Repartir % equitativamente
                </button>
                <span
                  className={[
                    'rounded-full px-3 py-1 text-sm font-medium',
                    porcentajeHitos === 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800',
                  ].join(' ')}
                >
                  Suma: {porcentajeHitos}% / 100%
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {hitos.map((h, index) => (
                <article
                  key={h.id}
                  className={[
                    'rounded-xl border p-4 transition',
                    h.aprobado ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white',
                  ].join(' ')}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                    Desembolso {index + 1} de {hitos.length}
                  </p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="sm:col-span-2">
                      <label className="text-xs text-slate-500">Nombre de la fase</label>
                      <input
                        value={h.nombre}
                        onChange={(e) => actualizarCampoHito(h.id, 'nombre', e.target.value)}
                        className="mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs text-slate-500">Descripción de la fase del proyecto</label>
                      <textarea
                        rows={2}
                        value={h.descripcionFase ?? ''}
                        onChange={(e) => actualizarCampoHito(h.id, 'descripcionFase', e.target.value)}
                        className="mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        placeholder="Qué ocurre en el proyecto en este desembolso..."
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Fase del proyecto</label>
                      <select
                        value={h.faseProyecto ?? ''}
                        onChange={(e) => actualizarCampoHito(h.id, 'faseProyecto', e.target.value)}
                        className="mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        {FASES_PROYECTO_HBI.map((f) => (
                          <option key={f.codigo} value={f.codigo}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Porcentaje %</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={h.porcentaje}
                        onChange={(e) =>
                          actualizarCampoHito(h.id, 'porcentaje', Number(e.target.value) || 0)
                        }
                        className="mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Fecha programada</label>
                      <input
                        type="date"
                        value={fechaInputDesdeIso(h.fechaObjetivo)}
                        onChange={(e) => actualizarCampoHito(h.id, 'fechaObjetivo', e.target.value)}
                        className="mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    <span className="font-mono font-semibold text-indigo-800">
                      {h.id}
                    </span>
                    {' · '}
                    Monto calculado:{' '}
                    <span className="font-mono font-medium">{formatearMonto(h.monto, moneda)}</span>
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={h.aprobado}
                        onChange={(e) => toggleAprobacionHito(h.id, e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      Aprobar monto base (pre-comité)
                    </label>
                    {h.aprobado ? (
                      <input
                        type="number"
                        value={h.montoAprobado}
                        onChange={(e) =>
                          actualizarMontoAprobadoHito(h.id, Number(e.target.value) || 0)
                        }
                        className="w-40 rounded border border-slate-300 px-2 py-1 font-mono text-sm"
                        aria-label="Monto aprobado"
                      />
                    ) : null}
                  </div>
                </article>
              ))}
            </div>

            {servicios.length > 0 ? (
              <aside className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="font-medium text-slate-900">Evidencias por desembolso (servicios en paso 4)</p>
                <p className="mt-1">
                  {servicios.map((s) => TIPOS_SERVICIO_LABEL[s]).join(' · ')}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Puede ajustar los servicios en el paso «Servicios HBI»; el checklist de cada hito se
                  actualizará sin perder porcentajes ni fechas.
                </p>
              </aside>
            ) : null}

            <DesembolsosEvidenciaPanel
              hitos={hitos}
              montoTotal={montoTotal}
              moneda={moneda}
              titulo="Vista previa — evidencia del plan de desembolsos"
              compacto
            />
          </section>
        ) : null}

        {paso === 4 ? (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">
              4 · Servicios HBI (Anexos 1, 2 y 3)
            </h2>
            <p className="text-sm text-slate-600">
              Contrate uno o más servicios. En Fase 4 (motor operativo) cada desembolso exigirá
              evidencias y checklist según los anexos activos.
            </p>
            <ServiciosHbiContratacion
              servicios={servicios}
              onToggle={toggleServicio}
              onSeleccionarTodos={seleccionarTodosServicios}
              anexoExpandido={anexoExpandido}
              onToggleExpandir={setAnexoExpandido}
            />
          </section>
        ) : null}

        {paso === 5 ? (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">5 · Resumen antes de crear</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">Crédito</dt>
                <dd className="font-medium text-slate-900">{nombreCredito || '—'}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">Tipo</dt>
                <dd className="font-medium text-slate-900">{TIPO_CREDITO_LABEL[tipoCredito]}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2">
                <dt className="text-xs text-slate-500">Deudor</dt>
                <dd className="font-medium text-slate-900">{deudorSel?.razonSocial ?? '—'}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2">
                <dt className="text-xs text-slate-500">Acreedores ({acreedores.length})</dt>
                <dd className="mt-1 space-y-1">
                  {acreedores.map((a) => (
                    <p key={a.id} className="text-sm text-slate-800">
                      {a.razonSocial} — {a.porcentaje}% ({formatearMonto(a.montoComprometido, moneda)})
                    </p>
                  ))}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">Monto total</dt>
                <dd className="font-mono font-semibold text-[var(--color-brand-primary)]">
                  {formatearMonto(montoTotal, moneda)}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2">
                <dt className="text-xs text-slate-500">Plan de desembolsos ({hitos.length})</dt>
                <dd className="mt-1 space-y-1">
                  {hitos.map((h) => (
                    <p key={h.id} className="text-sm text-slate-800">
                      {h.id} · {new Date(h.fechaObjetivo).toLocaleDateString('es-CO')} — {h.porcentaje}% (
                      {formatearMonto(h.monto, moneda)}) — {h.nombre}
                    </p>
                  ))}
                </dd>
              </div>
              <div className="rounded-lg bg-indigo-50 p-3 sm:col-span-2">
                <dt className="text-xs text-indigo-600">{AGENTE_FINANCIACION_HBI}</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {servicios.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-medium text-white"
                    >
                      {TIPOS_SERVICIO_LABEL[s]}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-slate-500">
              Al crear, la operación inicia en Fase 1 (contratos) con expediente maestro y
              trazabilidad activos desde el primer registro.
            </p>
          </section>
        ) : null}

        {errorForm ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorForm}
          </p>
        ) : null}
        {crear.error ? (
          <p className="mt-2 text-sm text-red-600">{crear.error.message}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            disabled={paso === 1}
            onClick={() => setPaso((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
            Anterior
          </button>
          {paso < 5 ? (
            <button
              type="button"
              onClick={irSiguiente}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-brand-primary)] px-5 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Siguiente
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={crear.isPending}
              onClick={() => void onSubmit()}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {crear.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Crear operación (Fase 1)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
