'use client';

import { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Users,
  Workflow,
  Landmark,
  Shield,
  Calculator,
  Kanban,
  Gavel,
  Calendar,
  FileText,
  Mail,
  Database,
} from 'lucide-react';
import { DEMO_PASSWORD, DEMO_USUARIO_PRINCIPAL } from '@/lib/auth/demo-users';

const SECCIONES = [
  {
    id: 'que-es',
    icon: BookOpen,
    titulo: '¿Qué es este demo?',
    contenido: (
      <>
        <p>
          Es una demostración de <strong>Helm Banca de Inversión (HBI)</strong> como{' '}
          <strong>agente de financiación</strong> en créditos sindicados: el deudor recibe recursos,
          varios acreedores prestan capital y HBI administra contratos, comunicaciones, expediente y
          desembolsos por hitos.
        </p>
        <p className="mt-2">
          Todo funciona <strong>sin PostgreSQL ni Azure</strong>: los datos viven en código (semilla) y
          en la <strong>caché del navegador</strong> (localStorage). Puedes crear operaciones, votar en
          comités, marcar obligaciones y reiniciar el demo cuando quieras.
        </p>
      </>
    ),
  },
  {
    id: 'usuarios',
    icon: Users,
    titulo: 'Usuarios de prueba y qué hace cada uno',
    contenido: (
      <>
        <p className="mb-3">
          El demo usa <strong>un solo usuario con acceso completo</strong> a todo el módulo HBI.
          Contraseña:{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5">{DEMO_PASSWORD}</code> — o un clic en
          «Entrar como María González».
        </p>
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-3 text-sm">
          <p className="font-medium text-slate-900">
            {DEMO_USUARIO_PRINCIPAL.nombre} {DEMO_USUARIO_PRINCIPAL.apellido}
          </p>
          <p className="text-slate-600">{DEMO_USUARIO_PRINCIPAL.email}</p>
          <p className="mt-1 text-slate-600">{DEMO_USUARIO_PRINCIPAL.descripcion}</p>
          <p className="mt-2 text-xs font-medium text-blue-800">
            Puede: crear operaciones, Kanban, subir/ver documentos, correos, ficha de viabilidad,
            desembolsos por hitos, trazabilidad, covenants, comité, simulador y reporte sindicado.
          </p>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Las acciones quedan registradas a su nombre en trazabilidad (documentos, fases, desembolsos).
        </p>
      </>
    ),
  },
  {
    id: 'flujo',
    icon: Workflow,
    titulo: 'Flujo operativo en 4 fases',
    contenido: (
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          <strong>Fase 1 — Contratos:</strong> subir y clasificar documentos (contrato marco, anexos,
          cronogramas). Requisito para avanzar: al menos 1 documento.
        </li>
        <li>
          <strong>Fase 2 — Correos:</strong> ficha de proyecto y viabilidad, registro de correos con lectura
          completa y envío simulado.
          Registrar correos entrantes y enviar respuestas (simuladas, sin Microsoft Graph).
        </li>
        <li>
          <strong>Fase 3 — Expediente 360:</strong> vista consolidada: deudor, acreedores, montos,
          hitos de desembolso, documentos y alertas.
        </li>
        <li>
          <strong>Fase 4 — Seguimiento:</strong> checklist por Anexo 1, 2 y 3 (actividades
          recurrentes del crédito).
        </li>
      </ol>
    ),
  },
  {
    id: 'nueva-op',
    icon: Landmark,
    titulo: 'Crear una operación nueva',
    contenido: (
      <p>
        Menú <strong>Nueva operación</strong> — paso 3 clave: elige{' '}
        <strong>cuántos desembolsos</strong> (2 a 8), el <strong>% de cada fase</strong>, la{' '}
        <strong>fecha programada</strong> y opcionalmente aprueba el monto base. Al guardar, el plan
        queda evidenciado con timeline, barra de % y tabla en el detalle del crédito.
      </p>
    ),
  },
  {
    id: 'ib-plus',
    icon: Shield,
    titulo: 'Módulos IB+ (por operación)',
    contenido: (
      <ul className="space-y-2">
        <li>
          <strong>Covenants:</strong> DSCR, leverage, LLCR, reporting, ESG, garantías — semáforo y
          marcar cumplido.
        </li>
        <li>
          <strong>Comité crédito:</strong> votar desembolsos, waivers y modificaciones; aprobar sesión
          sincroniza hitos aprobados.
        </li>
        <li>
          <strong>Calendario:</strong> obligaciones con fecha (reportes, pagos, comités, garantías).
        </li>
        <li>
          <strong>Reporte sindicado:</strong> generar informe trimestral, descargar .txt, enviar demo
          al sindicado.
        </li>
        <li>
          <strong>Simulador Anexo 3:</strong> escenarios base y stress (tasa +100 bps, EBITDA −15%,
          retraso) con ratios vs umbrales de covenant.
        </li>
      </ul>
    ),
  },
  {
    id: 'cartera',
    icon: Kanban,
    titulo: 'Kanban y cartera',
    contenido: (
      <ul className="space-y-2">
        <li>
          <strong>Inicio:</strong> panel ejecutivo con exposición, alertas y exposición por tipo de
          crédito.
        </li>
        <li>
          <strong>Kanban:</strong> tablero por fase del workflow; también en Operaciones (vista Kanban).
        </li>
        <li>
          <strong>Cartera riesgos:</strong> consolidado de covenants, comités y obligaciones de todas
          las operaciones.
        </li>
      </ul>
    ),
  },
  {
    id: 'persistencia',
    icon: Database,
    titulo: 'Persistencia y reinicio',
    contenido: (
      <p>
        Cada cambio (documentos, correos, votos, obligaciones) se guarda en{' '}
        <strong>localStorage</strong> del navegador. El banner amarillo muestra la última actualización
        y el botón <strong>Restaurar demo</strong> vuelve a los 7 créditos de ejemplo. Operación
        estrella: <strong>CRED-2026-00007</strong> (Metro Verde) en Fase 4 con hitos H1–H4.
      </p>
    ),
  },
] as const;

export function GuiaDemoHbi() {
  const [abierta, setAbierta] = useState(false);
  const [seccionAbierta, setSeccionAbierta] = useState<string | null>('que-es');

  return (
    <section
      id="guia-demo-hbi"
      className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/80 to-white shadow-sm"
    >
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        aria-expanded={abierta}
      >
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-blue-700" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Guía completa del demo HBI</h2>
            <p className="text-sm text-slate-600">
              Cómo funciona el simulado, usuarios, fases, módulos IB+ y qué puedes hacer
            </p>
          </div>
        </div>
        {abierta ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-slate-500" />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" />
        )}
      </button>

      {abierta ? (
        <div className="border-t border-blue-100 px-5 pb-5">
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: FileText, label: 'Documentos' },
              { icon: Mail, label: 'Correos' },
              { icon: Gavel, label: 'Comité' },
              { icon: Calendar, label: 'Calendario' },
              { icon: Calculator, label: 'Simulador' },
              { icon: Shield, label: 'Covenants' },
              { icon: Kanban, label: 'Kanban' },
              { icon: Landmark, label: 'Operaciones' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <Icon className="h-4 w-4 text-blue-600" />
                {label}
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            {SECCIONES.map((s) => {
              const Icon = s.icon;
              const expandida = seccionAbierta === s.id;
              return (
                <div key={s.id} className="rounded-lg border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setSeccionAbierta(expandida ? null : s.id)}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-slate-900"
                  >
                    <Icon className="h-4 w-4 text-blue-600" />
                    {s.titulo}
                    <span className="ml-auto text-slate-400">{expandida ? '−' : '+'}</span>
                  </button>
                  {expandida ? (
                    <div className="border-t border-slate-100 px-4 pb-4 text-sm leading-relaxed text-slate-700">
                      {s.contenido}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
