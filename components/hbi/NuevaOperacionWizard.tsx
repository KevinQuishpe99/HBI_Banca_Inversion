'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calculator,
  Check,
  ChevronDown,
  ChevronUp,
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
import { GUIA_ANEXOS, GUIA_FASES_WORKFLOW } from '@/lib/hbi/anexos-guia';
import {
  formatearMonto,
  generarHitosDesembolso,
  recalcularMontosHitos,
} from '@/lib/hbi/hitos-plantilla';
import type { HitoDesembolsoHbi, ParticipacionAcreedor, TipoCreditoHbi } from '@/types/hbi/cliente.types';
import { TIPO_CREDITO_LABEL } from '@/types/hbi/cliente.types';
import type { TipoServicioHbi } from '@/types/hbi/operacion.types';
import { TIPOS_SERVICIO_LABEL } from '@/types/hbi/operacion.types';

const PASOS = [
  { id: 1, titulo: 'Crédito', icon: FileText },
  { id: 2, titulo: 'Partes', icon: Users },
  { id: 3, titulo: 'Montos y fases', icon: Wallet },
  { id: 4, titulo: 'Anexos HBI', icon: Shield },
  { id: 5, titulo: 'Resumen', icon: Check },
] as const;

const SERVICIOS: TipoServicioHbi[] = [
  'ANEXO_1_ADMINISTRATIVO',
  'ANEXO_2_GARANTIAS',
  'ANEXO_3_CALCULO',
];

const ICONO_ANEXO = {
  ANEXO_1_ADMINISTRATIVO: FileText,
  ANEXO_2_GARANTIAS: Shield,
  ANEXO_3_CALCULO: Calculator,
} as const;

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
  const [hitos, setHitos] = useState<HitoDesembolsoHbi[]>(() =>
    generarHitosDesembolso(150_000_000, servicios)
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
      setHitos(generarHitosDesembolso(montoTotal, next));
      return next;
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
            <h1 className="text-2xl font-bold text-slate-900">Nueva operación de crédito</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Configure desde el inicio al deudor, los acreedores del sindicado, el monto aprobado por
              fases y los Anexos HBI que administrará Helm Banca de Inversión.
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
            <h2 className="text-lg font-semibold text-slate-900">3 · Monto total y desembolsos por fases</h2>
            <p className="text-sm text-slate-600">
              Defina el monto aprobado del crédito y apruebe el monto base de cada hito antes del
              desembolso. HBI validará el checklist documental por Anexo en cada fase.
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

            <p className="text-sm font-medium text-slate-700">
              Total comprometido acreedores:{' '}
              <span className="font-mono text-[var(--color-brand-primary)]">
                {formatearMonto(
                  acreedores.reduce((s, a) => s + a.montoComprometido, 0),
                  moneda
                )}
              </span>
              {' · '}
              Monto aprobado en hitos:{' '}
              <span className="font-mono text-emerald-700">
                {formatearMonto(montoAprobadoTotal, moneda)}
              </span>
            </p>

            <div className="space-y-3">
              {hitos.map((h) => (
                <article
                  key={h.id}
                  className={[
                    'rounded-xl border p-4 transition',
                    h.aprobado ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white',
                  ].join(' ')}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {h.id} · {h.nombre}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-600">
                        {h.porcentaje}% del total ={' '}
                        <span className="font-mono font-medium">{formatearMonto(h.monto, moneda)}</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        Fecha objetivo:{' '}
                        {new Date(h.fechaObjetivo).toLocaleDateString('es-CO', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={h.aprobado}
                        onChange={(e) => toggleAprobacionHito(h.id, e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      Aprobar monto base
                    </label>
                  </div>
                  {h.aprobado ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <label className="text-xs text-slate-600">Monto aprobado:</label>
                      <input
                        type="number"
                        value={h.montoAprobado}
                        onChange={(e) =>
                          actualizarMontoAprobadoHito(h.id, Number(e.target.value) || 0)
                        }
                        className="w-40 rounded border border-slate-300 px-2 py-1 font-mono text-sm"
                      />
                    </div>
                  ) : null}
                  <ul className="mt-3 grid gap-1 sm:grid-cols-2">
                    {h.checklistDocumental.map((c) => (
                      <li key={c.item} className="text-xs text-slate-600">
                        • {c.item}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <p
              className={[
                'text-xs',
                porcentajeHitos === 100 ? 'text-emerald-700' : 'text-amber-700',
              ].join(' ')}
            >
              Suma de hitos: {porcentajeHitos}% (debe ser 100%)
            </p>
          </section>
        ) : null}

        {paso === 4 ? (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">4 · Anexos HBI (servicios contratados)</h2>
            <p className="text-sm text-slate-600">
              Seleccione qué servicios administrará HBI como agente de financiación. Cada Anexo
              activa actividades y checklist en el motor operativo (Fase 4).
            </p>
            {GUIA_ANEXOS.map((g) => {
              const Icon = ICONO_ANEXO[g.codigo];
              const activo = servicios.includes(g.codigo);
              const expandido = anexoExpandido === g.codigo;
              return (
                <article
                  key={g.codigo}
                  className={[
                    'rounded-xl border transition',
                    activo
                      ? 'border-[var(--color-brand-primary)]/40 bg-[var(--color-brand-accent)]/20'
                      : 'border-slate-200 bg-white',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-3 p-4">
                    <input
                      type="checkbox"
                      checked={activo}
                      onChange={() => toggleServicio(g.codigo)}
                      className="mt-1 rounded border-slate-300"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-[var(--color-brand-primary)]" />
                        <p className="font-semibold text-slate-900">{g.titulo}</p>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{g.resumen}</p>
                      <button
                        type="button"
                        onClick={() => setAnexoExpandido(expandido ? null : g.codigo)}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-brand-primary)]"
                      >
                        {expandido ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {expandido ? 'Ocultar detalle' : 'Ver responsabilidades y documentos'}
                      </button>
                      {expandido ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-semibold uppercase text-slate-500">
                              Responsabilidades
                            </p>
                            <ul className="mt-1 space-y-1">
                              {g.responsabilidades.map((r) => (
                                <li key={r} className="text-xs text-slate-700">
                                  ✓ {r}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase text-slate-500">
                              Documentos clave
                            </p>
                            <ul className="mt-1 space-y-1">
                              {g.documentosClave.map((d) => (
                                <li key={d} className="text-xs text-slate-700">
                                  📄 {d}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
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
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">Hitos aprobados</dt>
                <dd className="font-mono font-semibold text-emerald-700">
                  {formatearMonto(montoAprobadoTotal, moneda)}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2">
                <dt className="text-xs text-slate-500">Anexos HBI</dt>
                <dd className="mt-1 flex flex-wrap gap-2">
                  {servicios.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-[var(--color-brand-primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-brand-primary)]"
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
