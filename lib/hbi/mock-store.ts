/**
 * Datos quemados para demo HBI (sin base de datos).
 * En el navegador se persisten en localStorage (caché) entre recargas.
 */
import { clasificarDocumentoPorNombre } from '@/lib/hbi/classify-document';
import {
  clearPersistedMockSnapshot,
  loadPersistedMockSnapshot,
  savePersistedMockSnapshot,
} from '@/lib/hbi/mock-persistence';
import { extraerDatosClaveDocumento } from '@/lib/hbi/extract-document-metadata';
import { detectarOrigenCorreo, detectarPrioridadCorreo } from '@/lib/hbi/detect-email-origin';
import type {
  ActividadServicio,
  CorreoEnviadoHbi,
  CorreoOperacion,
  DocumentoContractual,
  EstadoIntegralHbi,
  EventoTrazabilidad,
  ExpedienteMaestro,
  FaseWorkflowHbi,
  OperacionCredito,
  OperacionVista360,
  OrigenCorreoHbi,
  PrioridadCorreoHbi,
  TipoDocumentoContractual,
  TipoServicioHbi,
} from '@/types/hbi/operacion.types';

const ORDEN_FASES: FaseWorkflowHbi[] = [
  'FASE_1_CONTRATOS',
  'FASE_2_CORREOS',
  'FASE_3_EXPEDIENTE',
  'FASE_4_SEGUIMIENTO',
];

let seq = 100;
let storeHydrated = false;
let usuarioActivoNombre = 'Usuario demo';

function uid(prefijo: string): string {
  seq += 1;
  return `${prefijo}-${seq}`;
}

function haceDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function haceHoras(n: number): string {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d.toISOString();
}

function hashDemo(texto: string): string {
  let h = 0;
  for (let i = 0; i < texto.length; i += 1) {
    h = (h << 5) - h + texto.charCodeAt(i);
    h |= 0;
  }
  return `SHA-DEMO-${Math.abs(h).toString(16).padStart(8, '0')}`;
}

function actor(): string {
  return usuarioActivoNombre;
}

function ensureHydrated(): void {
  if (typeof window === 'undefined' || storeHydrated) return;
  storeHydrated = true;
  const snap = loadPersistedMockSnapshot();
  if (snap?.store && typeof snap.store === 'object') {
    store = snap.store as Store;
    seq = typeof snap.seq === 'number' ? snap.seq : seq;
  }
}

function persist(): void {
  if (typeof window === 'undefined') return;
  savePersistedMockSnapshot(seq, store);
}

/** Sincroniza el nombre del usuario de sesión para trazabilidad. */
export function setMockUsuarioActivo(nombre: string): void {
  usuarioActivoNombre = nombre.trim() || 'Usuario demo';
}

type HistorialEntry = {
  id: string;
  operacionId: string;
  tipoEvento: string;
  comentario?: string;
  faseAnterior?: FaseWorkflowHbi;
  faseNueva?: FaseWorkflowHbi;
  usuarioNombre?: string;
  creadoEn: string;
};

type Store = {
  operaciones: OperacionCredito[];
  documentos: DocumentoContractual[];
  correos: CorreoOperacion[];
  correosEnviados: CorreoEnviadoHbi[];
  actividades: ActividadServicio[];
  historial: HistorialEntry[];
  expedientes: ExpedienteMaestro[];
};

function crearExpediente(op: OperacionCredito, docs: DocumentoContractual[], correos: CorreoOperacion[]): ExpedienteMaestro {
  return {
    id: uid('exp'),
    operacionId: op.id,
    resumenContractual: {
      codigoOperacion: op.codigoOperacion,
      nombreCredito: op.nombreCredito,
      deudor: op.deudor,
      totalDocumentos: docs.length,
      serviciosActivos: op.serviciosActivos,
    },
    cronogramas: docs
      .filter((d) => d.tipoDocumento === 'CRONOGRAMA')
      .map((d) => ({ fuente: d.nombreArchivo, idDocumento: d.id })),
    responsables: [{ nombre: 'María González', rol: 'Responsable HBI' }],
    comunicacionesResumen: {
      totalCorreos: correos.length,
      porOrigen: correos.reduce<Record<string, number>>((acc, c) => {
        acc[c.origen] = (acc[c.origen] ?? 0) + 1;
        return acc;
      }, {}),
    },
    alertas: op.alertasActivas
      ? [{ tipo: 'DEMO', mensaje: 'Correo urgente pendiente de revisión', severidad: 'alta' }]
      : [],
    consolidadoEn: haceDias(2),
  };
}

function seedStore(): Store {
  const op1: OperacionCredito = {
    id: 'mock-op-001',
    codigoOperacion: 'CRED-2026-00001',
    nombreCredito: 'Crédito Sindicado — Proyecto Energía Andina',
    descripcion: 'Agente de financiación HBI — paquete contractual completo.',
    deudor: 'Energía Andina S.A.',
    agenteFinanciacion: 'HBI',
    faseActual: 'FASE_4_SEGUIMIENTO',
    serviciosActivos: ['ANEXO_1_ADMINISTRATIVO', 'ANEXO_2_GARANTIAS', 'ANEXO_3_CALCULO'],
    responsableId: 'mock-user-1',
    creadoPor: 'mock-user-1',
    metadata: {},
    alertasActivas: true,
    proximosPasos: 'Completar 2 actividad(es) pendiente(s) del motor operativo por anexo.',
    creadoEn: haceDias(30),
    actualizadoEn: haceHoras(2),
  };

  const op2: OperacionCredito = {
    id: 'mock-op-002',
    codigoOperacion: 'CRED-2026-00002',
    nombreCredito: 'Línea de Crédito Corporativa — Grupo Pacífico',
    deudor: 'Grupo Pacífico Holdings',
    agenteFinanciacion: 'HBI',
    faseActual: 'FASE_2_CORREOS',
    serviciosActivos: ['ANEXO_1_ADMINISTRATIVO', 'ANEXO_3_CALCULO'],
    creadoPor: 'mock-user-1',
    metadata: {},
    alertasActivas: false,
    proximosPasos: 'Registrar correos de Agente–HBI, Deudor y Acreedores en la bandeja única.',
    creadoEn: haceDias(12),
    actualizadoEn: haceHoras(5),
  };

  const op3: OperacionCredito = {
    id: 'mock-op-003',
    codigoOperacion: 'CRED-2026-00003',
    nombreCredito: 'Crédito Infraestructura Vial — Fase I',
    deudor: 'Consorcio Vial Ecuador',
    agenteFinanciacion: 'HBI',
    faseActual: 'FASE_1_CONTRATOS',
    serviciosActivos: ['ANEXO_1_ADMINISTRATIVO', 'ANEXO_2_GARANTIAS'],
    creadoPor: 'mock-user-1',
    metadata: {},
    alertasActivas: false,
    proximosPasos: 'Cargar y clasificar el paquete contractual completo (Anexos 1, 2 y 3 según aplique).',
    creadoEn: haceDias(3),
    actualizadoEn: haceDias(1),
  };

  const op4: OperacionCredito = {
    id: 'mock-op-004',
    codigoOperacion: 'CRED-2026-00004',
    nombreCredito: 'Financiación Proyecto Hospital Regional',
    deudor: 'Infraestructura Salud Colombia S.A.S.',
    agenteFinanciacion: 'HBI',
    faseActual: 'FASE_3_EXPEDIENTE',
    serviciosActivos: ['ANEXO_1_ADMINISTRATIVO', 'ANEXO_2_GARANTIAS', 'ANEXO_3_CALCULO'],
    creadoPor: 'mock-user-1',
    metadata: {},
    alertasActivas: true,
    proximosPasos: 'Consolidar expediente 360 y preparar ingreso al motor operativo de seguimiento.',
    creadoEn: haceDias(18),
    actualizadoEn: haceHoras(10),
  };

  const op5: OperacionCredito = {
    id: 'mock-op-005',
    codigoOperacion: 'CRED-2026-00005',
    nombreCredito: 'Refinanciación Portafolio Inmobiliario Empresarial',
    deudor: 'Patrimonio Urbano S.A.',
    agenteFinanciacion: 'HBI',
    faseActual: 'FASE_2_CORREOS',
    serviciosActivos: ['ANEXO_1_ADMINISTRATIVO', 'ANEXO_2_GARANTIAS'],
    creadoPor: 'mock-user-1',
    metadata: {},
    alertasActivas: false,
    proximosPasos: 'Completar trazabilidad de comunicaciones de deudor y acreedores del sindicato.',
    creadoEn: haceDias(9),
    actualizadoEn: haceHoras(14),
  };

  const op6: OperacionCredito = {
    id: 'mock-op-006',
    codigoOperacion: 'CRED-2026-00006',
    nombreCredito: 'Facility de Capital de Trabajo Agroexportador',
    deudor: 'AgroAndes Export S.A.',
    agenteFinanciacion: 'HBI',
    faseActual: 'FASE_1_CONTRATOS',
    serviciosActivos: ['ANEXO_3_CALCULO'],
    creadoPor: 'mock-user-1',
    metadata: {},
    alertasActivas: false,
    proximosPasos: 'Subir anexo de cálculo y cronograma base para iniciar validaciones financieras.',
    creadoEn: haceDias(2),
    actualizadoEn: haceHoras(18),
  };

  const op7: OperacionCredito = {
    id: 'mock-op-007',
    codigoOperacion: 'CRED-2026-00007',
    nombreCredito: 'Project Finance Metro Verde — Tramo Norte',
    descripcion: 'Operación premium de demo con desembolsos por hitos y checklist documental.',
    deudor: 'Concesionaria Metro Verde S.A.',
    agenteFinanciacion: 'HBI',
    faseActual: 'FASE_4_SEGUIMIENTO',
    serviciosActivos: ['ANEXO_1_ADMINISTRATIVO', 'ANEXO_2_GARANTIAS', 'ANEXO_3_CALCULO'],
    creadoPor: 'mock-user-1',
    metadata: {
      hitosDesembolso: [
        {
          id: 'H1',
          nombre: 'Cierre financiero inicial',
          porcentaje: 20,
          estado: 'COMPLETADO',
          fechaObjetivo: haceDias(25),
          checklistDocumental: [
            { item: 'Contrato marco firmado', cumplido: true },
            { item: 'Anexo 1 validado', cumplido: true },
            { item: 'Certificado fiduciario', cumplido: true },
          ],
        },
        {
          id: 'H2',
          nombre: 'Inicio de obra civil',
          porcentaje: 35,
          estado: 'EN_REVISION',
          fechaObjetivo: haceDias(5),
          checklistDocumental: [
            { item: 'Acta de inicio de obra', cumplido: true },
            { item: 'Pólizas vigentes (Anexo 2)', cumplido: true },
            { item: 'Cronograma recalculado (Anexo 3)', cumplido: false },
          ],
        },
        {
          id: 'H3',
          nombre: 'Avance 60% del proyecto',
          porcentaje: 25,
          estado: 'PENDIENTE',
          fechaObjetivo: haceDias(-20),
          checklistDocumental: [
            { item: 'Informe técnico interventoría', cumplido: false },
            { item: 'Certificación de garantías', cumplido: false },
            { item: 'Modelo financiero actualizado', cumplido: false },
          ],
        },
        {
          id: 'H4',
          nombre: 'Puesta en operación',
          porcentaje: 20,
          estado: 'PENDIENTE',
          fechaObjetivo: haceDias(-70),
          checklistDocumental: [
            { item: 'Acta de recibo final', cumplido: false },
            { item: 'Liberación de retenciones', cumplido: false },
          ],
        },
      ],
    },
    alertasActivas: true,
    proximosPasos:
      'Completar documentación faltante del Hito H2 para autorizar desembolso y habilitar H3.',
    creadoEn: haceDias(40),
    actualizadoEn: haceHoras(3),
  };

  const documentos: DocumentoContractual[] = [
    {
      id: 'mock-doc-1',
      operacionId: op1.id,
      tipoDocumento: 'CONTRATO_MARCO',
      nombreArchivo: 'Contrato_Marco_Energia_Andina_2026.pdf',
      datosExtraidos: { ...extraerDatosClaveDocumento('Contrato_Marco', 'CONTRATO_MARCO') },
      creadoEn: haceDias(28),
    },
    {
      id: 'mock-doc-2',
      operacionId: op1.id,
      tipoDocumento: 'ANEXO_1',
      nombreArchivo: 'Anexo_1_Agente_Administrativo.pdf',
      datosExtraidos: { ...extraerDatosClaveDocumento('Anexo_1', 'ANEXO_1') },
      creadoEn: haceDias(27),
    },
    {
      id: 'mock-doc-3',
      operacionId: op1.id,
      tipoDocumento: 'ANEXO_2',
      nombreArchivo: 'Anexo_2_Garantias.pdf',
      datosExtraidos: {},
      creadoEn: haceDias(27),
    },
    {
      id: 'mock-doc-4',
      operacionId: op1.id,
      tipoDocumento: 'CRONOGRAMA',
      nombreArchivo: 'Cronograma_Pagos_Q1-Q4.xlsx',
      datosExtraidos: {},
      creadoEn: haceDias(26),
    },
    {
      id: 'mock-doc-5',
      operacionId: op2.id,
      tipoDocumento: 'CONTRATO_MARCO',
      nombreArchivo: 'Contrato_Marco_Grupo_Pacifico.pdf',
      datosExtraidos: {},
      creadoEn: haceDias(10),
    },
    {
      id: 'mock-doc-6',
      operacionId: op2.id,
      tipoDocumento: 'ANEXO_3',
      nombreArchivo: 'Anexo_3_Calculo_Tasas.pdf',
      datosExtraidos: {},
      creadoEn: haceDias(9),
    },
    {
      id: 'mock-doc-7',
      operacionId: op4.id,
      tipoDocumento: 'CONTRATO_MARCO',
      nombreArchivo: 'Contrato_Marco_Hospital_Regional.pdf',
      datosExtraidos: {},
      creadoEn: haceDias(17),
    },
    {
      id: 'mock-doc-8',
      operacionId: op4.id,
      tipoDocumento: 'ANEXO_1',
      nombreArchivo: 'Anexo_1_Agente_Administrativo_Hospital.pdf',
      datosExtraidos: {},
      creadoEn: haceDias(16),
    },
    {
      id: 'mock-doc-9',
      operacionId: op4.id,
      tipoDocumento: 'ANEXO_2',
      nombreArchivo: 'Anexo_2_Garantias_Hospital.pdf',
      datosExtraidos: {},
      creadoEn: haceDias(16),
    },
    {
      id: 'mock-doc-10',
      operacionId: op4.id,
      tipoDocumento: 'ANEXO_3',
      nombreArchivo: 'Anexo_3_Calculo_Hospital.xlsx',
      datosExtraidos: {},
      creadoEn: haceDias(15),
    },
    {
      id: 'mock-doc-11',
      operacionId: op5.id,
      tipoDocumento: 'GARANTIA',
      nombreArchivo: 'Poliza_Cumplimiento_Patrimonio_Urbano.pdf',
      datosExtraidos: {},
      creadoEn: haceDias(8),
    },
    {
      id: 'mock-doc-12',
      operacionId: op6.id,
      tipoDocumento: 'CRONOGRAMA',
      nombreArchivo: 'Cronograma_AgroAndes_Proyecciones_2026.xlsx',
      datosExtraidos: {},
      creadoEn: haceDias(1),
    },
    {
      id: 'mock-doc-13',
      operacionId: op7.id,
      tipoDocumento: 'CONTRATO_MARCO',
      nombreArchivo: 'Contrato_Marco_Metro_Verde.pdf',
      datosExtraidos: {},
      creadoEn: haceDias(39),
    },
    {
      id: 'mock-doc-14',
      operacionId: op7.id,
      tipoDocumento: 'ANEXO_1',
      nombreArchivo: 'Anexo_1_Agente_Administrativo_Metro.pdf',
      datosExtraidos: {},
      creadoEn: haceDias(38),
    },
    {
      id: 'mock-doc-15',
      operacionId: op7.id,
      tipoDocumento: 'ANEXO_2',
      nombreArchivo: 'Anexo_2_Garantias_Metro.pdf',
      datosExtraidos: {},
      creadoEn: haceDias(37),
    },
    {
      id: 'mock-doc-16',
      operacionId: op7.id,
      tipoDocumento: 'ANEXO_3',
      nombreArchivo: 'Anexo_3_Modelo_Financiero_Metro.xlsx',
      datosExtraidos: {},
      creadoEn: haceDias(37),
    },
    {
      id: 'mock-doc-17',
      operacionId: op7.id,
      tipoDocumento: 'GARANTIA',
      nombreArchivo: 'Polizas_Todo_Riesgo_Proyecto_Metro.pdf',
      datosExtraidos: {},
      creadoEn: haceDias(8),
    },
  ];

  const correos: CorreoOperacion[] = [
    {
      id: 'mock-cor-in-1',
      operacionId: op1.id,
      remitente: 'agente@hbi.com.ec',
      asunto: 'Confirmación de mandato — Energía Andina',
      origen: 'AGENTE_HBI',
      prioridad: 'MEDIA',
      leido: true,
      recibidoEn: haceDias(20),
      direccion: 'RECIBIDO',
    },
    {
      id: 'mock-cor-in-2',
      operacionId: op1.id,
      remitente: 'tesoreria@energiaandina.com',
      asunto: 'Documentación complementaria deudor',
      origen: 'DEUDOR',
      prioridad: 'ALTA',
      leido: true,
      recibidoEn: haceDias(18),
      direccion: 'RECIBIDO',
    },
    {
      id: 'mock-cor-in-3',
      operacionId: op1.id,
      remitente: 'syndicate@bancoacreedor.com',
      asunto: 'Observaciones al cronograma — urgente',
      origen: 'ACREEDOR',
      prioridad: 'URGENTE',
      leido: false,
      recibidoEn: haceHoras(6),
      direccion: 'RECIBIDO',
    },
    {
      id: 'mock-cor-out-1',
      operacionId: op1.id,
      remitente: 'ia@comware.com.ec',
      asunto: '[CRED-2026-00001] Envío de paquete contractual a acreedores',
      origen: 'AGENTE_HBI',
      prioridad: 'MEDIA',
      leido: true,
      recibidoEn: haceDias(15),
      direccion: 'ENVIADO',
      destinatarioPrincipal: 'syndicate@bancoacreedor.com',
      cuerpoResumen: 'Se adjunta resumen del expediente consolidado.',
    },
    {
      id: 'mock-cor-in-4',
      operacionId: op2.id,
      remitente: 'legal@grupopacifico.com',
      asunto: 'Contrato marco firmado',
      origen: 'DEUDOR',
      prioridad: 'MEDIA',
      leido: false,
      recibidoEn: haceDias(4),
      direccion: 'RECIBIDO',
    },
    {
      id: 'mock-cor-in-5',
      operacionId: op4.id,
      remitente: 'project.office@saludcolombia.com',
      asunto: 'Acta de avance fase estructuración',
      origen: 'DEUDOR',
      prioridad: 'ALTA',
      leido: true,
      recibidoEn: haceDias(6),
      direccion: 'RECIBIDO',
    },
    {
      id: 'mock-cor-in-6',
      operacionId: op4.id,
      remitente: 'riesgo@bancolider.com',
      asunto: 'Ajustes requeridos en esquema de garantías',
      origen: 'ACREEDOR',
      prioridad: 'URGENTE',
      leido: false,
      recibidoEn: haceHoras(22),
      direccion: 'RECIBIDO',
    },
    {
      id: 'mock-cor-in-7',
      operacionId: op5.id,
      remitente: 'tesoreria@patrimoniourbano.com',
      asunto: 'Soportes de cumplimiento covenant financiero',
      origen: 'DEUDOR',
      prioridad: 'MEDIA',
      leido: false,
      recibidoEn: haceHoras(28),
      direccion: 'RECIBIDO',
    },
    {
      id: 'mock-cor-out-2',
      operacionId: op5.id,
      remitente: 'demo@hbi.com.ec',
      asunto: '[CRED-2026-00005] Solicitud de aclaración de garantías',
      origen: 'AGENTE_HBI',
      prioridad: 'MEDIA',
      leido: true,
      recibidoEn: haceHoras(30),
      direccion: 'ENVIADO',
      destinatarioPrincipal: 'tesoreria@patrimoniourbano.com',
      cuerpoResumen: 'Solicitamos detalle de pólizas y vigencias actualizadas.',
    },
    {
      id: 'mock-cor-in-8',
      operacionId: op7.id,
      remitente: 'pm@metroverde.com',
      asunto: 'Hito H2 listo para revisión documental',
      origen: 'DEUDOR',
      prioridad: 'ALTA',
      leido: false,
      recibidoEn: haceHoras(12),
      direccion: 'RECIBIDO',
    },
    {
      id: 'mock-cor-in-9',
      operacionId: op7.id,
      remitente: 'comite.riesgo@bancoancla.com',
      asunto: 'Pendiente cronograma recalculado para desembolso',
      origen: 'ACREEDOR',
      prioridad: 'URGENTE',
      leido: false,
      recibidoEn: haceHoras(9),
      direccion: 'RECIBIDO',
    },
    {
      id: 'mock-cor-out-3',
      operacionId: op7.id,
      remitente: 'demo@hbi.com.ec',
      asunto: '[CRED-2026-00007] Solicitud de soporte H2',
      origen: 'AGENTE_HBI',
      prioridad: 'MEDIA',
      leido: true,
      recibidoEn: haceHoras(7),
      direccion: 'ENVIADO',
      destinatarioPrincipal: 'pm@metroverde.com',
      cuerpoResumen: 'Enviar cronograma recalculado y certificación de garantías para habilitar desembolso.',
    },
  ];

  const correosEnviados: CorreoEnviadoHbi[] = [
    {
      id: 'mock-ce-1',
      operacionId: op1.id,
      codigoOperacion: op1.codigoOperacion,
      tipo: 'HBI_OPERACION',
      estado: 'enviado',
      destinatarioEmail: 'syndicate@bancoacreedor.com',
      remitente: 'ia@comware.com.ec',
      asunto: '[CRED-2026-00001] Envío de paquete contractual a acreedores',
      cuerpoTexto: 'Estimados, adjuntamos el resumen del expediente...',
      mensajeError: null,
      creadoEn: haceDias(15),
    },
    {
      id: 'mock-ce-2',
      operacionId: op1.id,
      codigoOperacion: op1.codigoOperacion,
      tipo: 'HBI_NOTIFICACION',
      estado: 'enviado',
      destinatarioEmail: 'tesoreria@energiaandina.com',
      remitente: 'ia@comware.com.ec',
      asunto: '[CRED-2026-00001] Solicitud de información adicional',
      cuerpoTexto: 'Por favor confirmar cronograma actualizado.',
      mensajeError: null,
      creadoEn: haceDias(12),
    },
    {
      id: 'mock-ce-3',
      operacionId: op1.id,
      codigoOperacion: op1.codigoOperacion,
      tipo: 'HBI_OPERACION',
      estado: 'fallido',
      destinatarioEmail: 'invalido@dominio-inexistente.xyz',
      remitente: 'ia@comware.com.ec',
      asunto: '[CRED-2026-00001] Reintento de notificación',
      cuerpoTexto: 'Prueba de envío.',
      mensajeError: 'Graph sendMail falló (demo): dominio no válido',
      creadoEn: haceDias(8),
    },
    {
      id: 'mock-ce-4',
      operacionId: op4.id,
      codigoOperacion: op4.codigoOperacion,
      tipo: 'HBI_OPERACION',
      estado: 'enviado',
      destinatarioEmail: 'riesgo@bancolider.com',
      remitente: 'demo@hbi.com.ec',
      asunto: '[CRED-2026-00004] Consolidado de expedientes para comité',
      cuerpoTexto: 'Se remite consolidado para revisión del comité de crédito.',
      mensajeError: null,
      creadoEn: haceHoras(20),
    },
    {
      id: 'mock-ce-5',
      operacionId: op5.id,
      codigoOperacion: op5.codigoOperacion,
      tipo: 'HBI_OPERACION',
      estado: 'enviado',
      destinatarioEmail: 'tesoreria@patrimoniourbano.com',
      remitente: 'demo@hbi.com.ec',
      asunto: '[CRED-2026-00005] Solicitud de aclaración de garantías',
      cuerpoTexto: 'Solicitamos detalle de pólizas y cartas de respaldo.',
      mensajeError: null,
      creadoEn: haceHoras(30),
    },
    {
      id: 'mock-ce-6',
      operacionId: op7.id,
      codigoOperacion: op7.codigoOperacion,
      tipo: 'HBI_DESEMBOLSO',
      estado: 'enviado',
      destinatarioEmail: 'pm@metroverde.com',
      remitente: 'demo@hbi.com.ec',
      asunto: '[CRED-2026-00007] Solicitud de soporte H2',
      cuerpoTexto: 'Favor adjuntar cronograma recalculado y certificado vigente de pólizas.',
      mensajeError: null,
      creadoEn: haceHoras(7),
    },
  ];

  const actividades: ActividadServicio[] = [
    {
      id: 'mock-act-1',
      operacionId: op1.id,
      tipoServicio: 'ANEXO_1_ADMINISTRATIVO',
      titulo: 'Validar documentación administrativa',
      estado: 'COMPLETADA',
      orden: 1,
    },
    {
      id: 'mock-act-2',
      operacionId: op1.id,
      tipoServicio: 'ANEXO_1_ADMINISTRATIVO',
      titulo: 'Coordinación con agente y acreedores',
      estado: 'EN_PROGRESO',
      orden: 2,
    },
    {
      id: 'mock-act-3',
      operacionId: op1.id,
      tipoServicio: 'ANEXO_2_GARANTIAS',
      titulo: 'Revisión de garantías vigentes',
      estado: 'PENDIENTE',
      orden: 1,
    },
    {
      id: 'mock-act-4',
      operacionId: op1.id,
      tipoServicio: 'ANEXO_3_CALCULO',
      titulo: 'Cálculo de cuotas y cronograma',
      estado: 'COMPLETADA',
      orden: 1,
    },
    {
      id: 'mock-act-5',
      operacionId: op4.id,
      tipoServicio: 'ANEXO_1_ADMINISTRATIVO',
      titulo: 'Validar checklist de condiciones precedentes',
      estado: 'EN_PROGRESO',
      orden: 1,
    },
    {
      id: 'mock-act-6',
      operacionId: op4.id,
      tipoServicio: 'ANEXO_2_GARANTIAS',
      titulo: 'Conciliar matriz de garantías y pólizas',
      estado: 'PENDIENTE',
      orden: 1,
    },
    {
      id: 'mock-act-7',
      operacionId: op4.id,
      tipoServicio: 'ANEXO_3_CALCULO',
      titulo: 'Validar metodología de tasa variable',
      estado: 'COMPLETADA',
      orden: 1,
    },
    {
      id: 'mock-act-8',
      operacionId: op7.id,
      tipoServicio: 'ANEXO_1_ADMINISTRATIVO',
      titulo: 'Validar checklist H2 para autorización de desembolso',
      estado: 'EN_PROGRESO',
      orden: 1,
    },
    {
      id: 'mock-act-9',
      operacionId: op7.id,
      tipoServicio: 'ANEXO_2_GARANTIAS',
      titulo: 'Certificar vigencia de pólizas de obra',
      estado: 'COMPLETADA',
      orden: 1,
    },
    {
      id: 'mock-act-10',
      operacionId: op7.id,
      tipoServicio: 'ANEXO_3_CALCULO',
      titulo: 'Recalcular cronograma financiero posterior a cambio de alcance',
      estado: 'PENDIENTE',
      orden: 1,
    },
  ];

  const historial: HistorialEntry[] = [
    {
      id: 'mock-h-1',
      operacionId: op1.id,
      tipoEvento: 'CREACION',
      comentario: 'Operación creada — inicio Fase 1',
      faseNueva: 'FASE_1_CONTRATOS',
      usuarioNombre: 'María González',
      creadoEn: haceDias(30),
    },
    {
      id: 'mock-h-2',
      operacionId: op1.id,
      tipoEvento: 'DOCUMENTO_SUBIDO',
      comentario: 'Documento clasificado como CONTRATO_MARCO',
      usuarioNombre: 'María González',
      creadoEn: haceDias(28),
    },
    {
      id: 'mock-h-3',
      operacionId: op1.id,
      tipoEvento: 'CAMBIO_FASE',
      comentario: 'Avance a Fase 2 — Registro de correos',
      faseAnterior: 'FASE_1_CONTRATOS',
      faseNueva: 'FASE_2_CORREOS',
      usuarioNombre: 'María González',
      creadoEn: haceDias(22),
    },
    {
      id: 'mock-h-4',
      operacionId: op1.id,
      tipoEvento: 'CORREO_REGISTRADO',
      comentario: 'Correo registrado — ACREEDOR',
      usuarioNombre: 'Carlos Ruiz',
      creadoEn: haceHoras(6),
    },
    {
      id: 'mock-h-5',
      operacionId: op1.id,
      tipoEvento: 'CORREO_ENVIADO',
      comentario: 'Correo enviado a syndicate@bancoacreedor.com',
      usuarioNombre: 'María González',
      creadoEn: haceDias(15),
    },
    {
      id: 'mock-h-6',
      operacionId: op1.id,
      tipoEvento: 'CAMBIO_FASE',
      comentario: 'Avance a Fase 4 — Seguimiento',
      faseAnterior: 'FASE_3_EXPEDIENTE',
      faseNueva: 'FASE_4_SEGUIMIENTO',
      usuarioNombre: 'María González',
      creadoEn: haceDias(5),
    },
    {
      id: 'mock-h-7',
      operacionId: op2.id,
      tipoEvento: 'CREACION',
      comentario: 'Operación creada',
      faseNueva: 'FASE_1_CONTRATOS',
      usuarioNombre: 'Carlos Ruiz',
      creadoEn: haceDias(12),
    },
    {
      id: 'mock-h-8',
      operacionId: op3.id,
      tipoEvento: 'CREACION',
      comentario: 'Operación creada',
      faseNueva: 'FASE_1_CONTRATOS',
      usuarioNombre: 'María González',
      creadoEn: haceDias(3),
    },
    {
      id: 'mock-h-9',
      operacionId: op4.id,
      tipoEvento: 'CREACION',
      comentario: 'Operación creada para estructuración hospitalaria',
      faseNueva: 'FASE_1_CONTRATOS',
      usuarioNombre: 'Roberto Vega',
      creadoEn: haceDias(18),
    },
    {
      id: 'mock-h-10',
      operacionId: op4.id,
      tipoEvento: 'CAMBIO_FASE',
      comentario: 'Avance a Fase 3 — Expediente maestro',
      faseAnterior: 'FASE_2_CORREOS',
      faseNueva: 'FASE_3_EXPEDIENTE',
      usuarioNombre: 'María González',
      creadoEn: haceDias(5),
    },
    {
      id: 'mock-h-11',
      operacionId: op5.id,
      tipoEvento: 'CREACION',
      comentario: 'Operación creada',
      faseNueva: 'FASE_1_CONTRATOS',
      usuarioNombre: 'Carlos Ruiz',
      creadoEn: haceDias(9),
    },
    {
      id: 'mock-h-12',
      operacionId: op6.id,
      tipoEvento: 'CREACION',
      comentario: 'Operación creada',
      faseNueva: 'FASE_1_CONTRATOS',
      usuarioNombre: 'Ana Torres',
      creadoEn: haceDias(2),
    },
    {
      id: 'mock-h-13',
      operacionId: op7.id,
      tipoEvento: 'CREACION',
      comentario: 'Operación premium creada con esquema de hitos de desembolso',
      faseNueva: 'FASE_1_CONTRATOS',
      usuarioNombre: 'Roberto Vega',
      creadoEn: haceDias(40),
    },
    {
      id: 'mock-h-14',
      operacionId: op7.id,
      tipoEvento: 'CAMBIO_FASE',
      comentario: 'Ingreso a Fase 4 para control recurrente por hitos',
      faseAnterior: 'FASE_3_EXPEDIENTE',
      faseNueva: 'FASE_4_SEGUIMIENTO',
      usuarioNombre: 'María González',
      creadoEn: haceDias(10),
    },
    {
      id: 'mock-h-15',
      operacionId: op7.id,
      tipoEvento: 'CORREO_ENVIADO',
      comentario: 'Solicitud de soporte documental para Hito H2',
      usuarioNombre: 'María González',
      creadoEn: haceHoras(7),
    },
  ];

  const operaciones = [op1, op2, op3, op4, op5, op6, op7];
  const expedientes = operaciones.map((op) => {
    const docs = documentos.filter((d) => d.operacionId === op.id);
    const cor = correos.filter((c) => c.operacionId === op.id);
    return crearExpediente(op, docs, cor);
  });

  return { operaciones, documentos, correos, correosEnviados, actividades, historial, expedientes };
}

let store: Store = seedStore();

function touchStore(): void {
  ensureHydrated();
}

function docsDe(opId: string) {
  return store.documentos.filter((d) => d.operacionId === opId);
}

function correosDe(opId: string) {
  return store.correos.filter((c) => c.operacionId === opId);
}

function actividadesDe(opId: string) {
  return store.actividades.filter((a) => a.operacionId === opId);
}

function historialDe(opId: string) {
  return store.historial.filter((h) => h.operacionId === opId);
}

function calcularEstado(op: OperacionCredito): EstadoIntegralHbi {
  const docs = docsDe(op.id);
  const correos = correosDe(op.id);
  const acts = actividadesDe(op.id);
  const idx = ORDEN_FASES.indexOf(op.faseActual);
  const siguiente = idx < ORDEN_FASES.length - 1 ? ORDEN_FASES[idx + 1] : null;

  const requisitos: EstadoIntegralHbi['requisitosFase'] = [];
  let puedeAvanzar = false;
  let mensajeAvance: string | undefined;

  if (siguiente === 'FASE_2_CORREOS') {
    requisitos.push({
      codigo: 'DOC_MIN',
      descripcion: 'Al menos un documento contractual cargado',
      cumplido: docs.length >= 1,
      obligatorio: true,
    });
    puedeAvanzar = docs.length >= 1;
    if (!puedeAvanzar) mensajeAvance = 'Cargue al menos un documento en Fase 1.';
  } else if (siguiente === 'FASE_3_EXPEDIENTE') {
    requisitos.push({
      codigo: 'CORREO_MIN',
      descripcion: 'Al menos un correo en la bandeja',
      cumplido: correos.filter((c) => c.direccion !== 'ENVIADO').length >= 1,
      obligatorio: true,
    });
    puedeAvanzar = correos.length >= 1;
    if (!puedeAvanzar) mensajeAvance = 'Registre al menos un correo en Fase 2.';
  } else if (siguiente === 'FASE_4_SEGUIMIENTO') {
    requisitos.push({
      codigo: 'EXPEDIENTE',
      descripcion: 'Expediente con documentación',
      cumplido: docs.length >= 1,
      obligatorio: true,
    });
    puedeAvanzar = docs.length >= 1;
  } else {
    puedeAvanzar = false;
  }

  const avancePorAnexo: EstadoIntegralHbi['avancePorAnexo'] = {};
  for (const s of op.serviciosActivos) {
    const del = acts.filter((a) => a.tipoServicio === s);
    const total = del.length;
    const completadas = del.filter((a) => a.estado === 'COMPLETADA').length;
    avancePorAnexo[s] = {
      total,
      completadas,
      porcentaje: total ? Math.round((completadas / total) * 100) : 0,
    };
  }

  const completadas = acts.filter((a) => a.estado === 'COMPLETADA').length;
  const avanceGlobal =
    op.faseActual === 'FASE_4_SEGUIMIENTO' && acts.length
      ? Math.round((completadas / acts.length) * 100)
      : [25, 50, 75, 100][idx] ?? 0;

  return {
    faseActual: op.faseActual,
    proximosPasos: op.proximosPasos ?? 'Sin pendientes.',
    alertasActivas: op.alertasActivas,
    avanceGlobal,
    avancePorAnexo,
    requisitosFase: requisitos,
    puedeAvanzarFase: puedeAvanzar,
    mensajeAvance,
  };
}

function buildTrazabilidad(opId: string): EventoTrazabilidad[] {
  const eventos: EventoTrazabilidad[] = [];

  for (const h of historialDe(opId)) {
    eventos.push({
      id: `ev-h-${h.id}`,
      tipo: h.tipoEvento === 'CAMBIO_FASE' ? 'CAMBIO_FASE' : 'HISTORIAL',
      titulo: h.tipoEvento.replace(/_/g, ' '),
      descripcion: h.comentario,
      usuarioNombre: h.usuarioNombre,
      creadoEn: h.creadoEn,
    });
  }

  for (const d of docsDe(opId)) {
    const extra = d.datosExtraidos as { hashContenido?: string; version?: number };
    eventos.push({
      id: `ev-d-${d.id}`,
      tipo: 'DOCUMENTO',
      titulo: `Documento: ${d.nombreArchivo}`,
      descripcion: `${d.tipoDocumento}${extra.hashContenido ? ` · ${extra.hashContenido}` : ''}`,
      usuarioNombre: (d.datosExtraidos.subidoPor as string | undefined) ?? undefined,
      detalle: {
        tipoDocumento: d.tipoDocumento,
        hashContenido: extra.hashContenido,
        version: extra.version ?? 1,
        nombreArchivo: d.nombreArchivo,
      },
      creadoEn: d.creadoEn,
    });
  }

  for (const c of correosDe(opId)) {
    eventos.push({
      id: `ev-c-${c.id}`,
      tipo: c.direccion === 'ENVIADO' ? 'CORREO_ENVIADO' : 'CORREO_RECIBIDO',
      titulo: c.asunto,
      descripcion: `${c.remitente} · ${c.origen}`,
      creadoEn: c.recibidoEn,
    });
  }

  for (const e of store.correosEnviados.filter((x) => x.operacionId === opId)) {
    if (!eventos.some((ev) => ev.titulo.includes(e.asunto))) {
      eventos.push({
        id: `ev-ce-${e.id}`,
        tipo: 'CORREO_ENVIADO',
        titulo: `Enviado (${e.estado}): ${e.asunto}`,
        descripcion: `Para: ${e.destinatarioEmail}`,
        creadoEn: e.creadoEn,
      });
    }
  }

  for (const a of actividadesDe(opId)) {
    eventos.push({
      id: `ev-a-${a.id}`,
      tipo: 'ACTIVIDAD',
      titulo: a.titulo,
      descripcion: `Estado: ${a.estado}`,
      tipoServicio: a.tipoServicio,
      creadoEn: haceHoras(1),
    });
  }

  eventos.sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime());
  return eventos;
}

export const MockHbiStore = {
  reset() {
    touchStore();
    store = seedStore();
    seq = 100;
    clearPersistedMockSnapshot();
    persist();
  },

  listar(fase?: FaseWorkflowHbi): OperacionCredito[] {
    touchStore();
    const list = [...store.operaciones].sort(
      (a, b) => new Date(b.actualizadoEn).getTime() - new Date(a.actualizadoEn).getTime()
    );
    return fase ? list.filter((o) => o.faseActual === fase) : list;
  },

  obtener(id: string): OperacionCredito | null {
    touchStore();
    return store.operaciones.find((o) => o.id === id) ?? null;
  },

  vista360(id: string): OperacionVista360 | null {
    touchStore();
    const op = MockHbiStore.obtener(id);
    if (!op) return null;
    const exp = store.expedientes.find((e) => e.operacionId === id);
    return {
      ...op,
      documentos: docsDe(id),
      correos: correosDe(id),
      expediente: exp,
      actividades: actividadesDe(id),
      historialReciente: historialDe(id).map((h) => ({
        tipoEvento: h.tipoEvento,
        comentario: h.comentario,
        creadoEn: h.creadoEn,
      })),
    };
  },

  estadoIntegral(id: string): EstadoIntegralHbi | null {
    touchStore();
    const op = MockHbiStore.obtener(id);
    return op ? calcularEstado(op) : null;
  },

  trazabilidad(id: string) {
    touchStore();
    const eventos = buildTrazabilidad(id);
    return { eventos, total: eventos.length };
  },

  correosEnviados(id: string) {
    touchStore();
    const items = store.correosEnviados
      .filter((c) => c.operacionId === id)
      .sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime());
    return { items, total: items.length };
  },

  documentos(id: string) {
    touchStore();
    return docsDe(id);
  },

  correos(id: string) {
    touchStore();
    return correosDe(id);
  },

  actividades(id: string, tipo?: TipoServicioHbi) {
    touchStore();
    const list = actividadesDe(id);
    return tipo ? list.filter((a) => a.tipoServicio === tipo) : list;
  },

  crear(input: {
    nombreCredito: string;
    descripcion?: string;
    deudor?: string;
    serviciosActivos: TipoServicioHbi[];
  }): OperacionCredito {
    touchStore();
    const n = store.operaciones.length + 1;
    const op: OperacionCredito = {
      id: uid('mock-op'),
      codigoOperacion: `CRED-2026-${String(n).padStart(5, '0')}`,
      nombreCredito: input.nombreCredito,
      descripcion: input.descripcion,
      deudor: input.deudor,
      agenteFinanciacion: 'HBI',
      faseActual: 'FASE_1_CONTRATOS',
      serviciosActivos: input.serviciosActivos,
      creadoPor: 'mock-user-1',
      metadata: {},
      alertasActivas: false,
      proximosPasos: 'Cargar y clasificar el paquete contractual completo.',
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    };
    store.operaciones.unshift(op);
    store.expedientes.push(crearExpediente(op, [], []));
    store.historial.unshift({
      id: uid('mock-h'),
      operacionId: op.id,
      tipoEvento: 'CREACION',
      comentario: 'Operación creada (demo)',
      faseNueva: 'FASE_1_CONTRATOS',
      usuarioNombre: actor(),
      creadoEn: op.creadoEn,
    });
    persist();
    return op;
  },

  avanzarFase(id: string, nuevaFase: FaseWorkflowHbi): OperacionCredito {
    touchStore();
    const op = store.operaciones.find((o) => o.id === id);
    if (!op) throw new Error('Operación no encontrada');
    const estado = calcularEstado(op);
    if (!estado.puedeAvanzarFase && ORDEN_FASES.indexOf(nuevaFase) > ORDEN_FASES.indexOf(op.faseActual)) {
      throw new Error(estado.mensajeAvance ?? 'Requisitos pendientes');
    }
    const anterior = op.faseActual;
    op.faseActual = nuevaFase;
    op.actualizadoEn = new Date().toISOString();
    if (nuevaFase === 'FASE_4_SEGUIMIENTO') {
      MockHbiStore.inicializarActividadesFase4(id);
    }
    store.historial.unshift({
      id: uid('mock-h'),
      operacionId: id,
      tipoEvento: 'CAMBIO_FASE',
      comentario: `Avance a ${nuevaFase}`,
      faseAnterior: anterior,
      faseNueva: nuevaFase,
      usuarioNombre: actor(),
      creadoEn: op.actualizadoEn,
    });
    op.proximosPasos = calcularEstado(op).proximosPasos;
    persist();
    return op;
  },

  inicializarActividadesFase4(operacionId: string) {
    touchStore();
    const op = MockHbiStore.obtener(operacionId);
    if (!op) return;
    const plantillas: Record<TipoServicioHbi, string[]> = {
      ANEXO_1_ADMINISTRATIVO: ['Validar documentación administrativa', 'Reporte de estado'],
      ANEXO_2_GARANTIAS: ['Revisión de garantías', 'Certificación de cumplimiento'],
      ANEXO_3_CALCULO: ['Cálculo de cuotas', 'Validación de tasas'],
    };
    for (const s of op.serviciosActivos) {
      if (actividadesDe(operacionId).some((a) => a.tipoServicio === s)) continue;
      plantillas[s].forEach((titulo, i) => {
        store.actividades.push({
          id: uid('mock-act'),
          operacionId,
          tipoServicio: s,
          titulo,
          estado: 'PENDIENTE',
          orden: i + 1,
        });
      });
    }
    persist();
  },

  subirDocumento(operacionId: string, fileName: string, tipoManual?: TipoDocumentoContractual): DocumentoContractual {
    touchStore();
    const clasif = tipoManual
      ? { tipo: tipoManual, confianza: 1 }
      : clasificarDocumentoPorNombre(fileName);
    const ahora = new Date().toISOString();
    const hashContenido = hashDemo(`${fileName}-${ahora}`);
    const doc: DocumentoContractual = {
      id: uid('mock-doc'),
      operacionId,
      tipoDocumento: clasif.tipo,
      nombreArchivo: fileName,
      datosExtraidos: {
        ...extraerDatosClaveDocumento(fileName, clasif.tipo),
        hashContenido,
        version: 1,
        subidoPor: actor(),
      },
      creadoEn: ahora,
    };
    store.documentos.unshift(doc);
    store.historial.unshift({
      id: uid('mock-h'),
      operacionId,
      tipoEvento: 'DOCUMENTO_SUBIDO',
      comentario: `Clasificado como ${clasif.tipo} · ${hashContenido}`,
      usuarioNombre: actor(),
      creadoEn: doc.creadoEn,
    });
    const op = MockHbiStore.obtener(operacionId);
    if (op) op.actualizadoEn = doc.creadoEn;
    persist();
    return doc;
  },

  registrarCorreo(
    operacionId: string,
    input: { remitente: string; asunto: string; cuerpoResumen?: string; origen?: OrigenCorreoHbi; prioridad?: PrioridadCorreoHbi }
  ): CorreoOperacion {
    touchStore();
    const origen = input.origen ?? detectarOrigenCorreo(input.remitente, input.asunto);
    const prioridad = input.prioridad ?? detectarPrioridadCorreo(input.asunto, input.cuerpoResumen);
    const c: CorreoOperacion = {
      id: uid('mock-cor'),
      operacionId,
      remitente: input.remitente,
      asunto: input.asunto,
      origen,
      prioridad,
      leido: false,
      recibidoEn: new Date().toISOString(),
      direccion: 'RECIBIDO',
      cuerpoResumen: input.cuerpoResumen,
    };
    store.correos.unshift(c);
    store.historial.unshift({
      id: uid('mock-h'),
      operacionId,
      tipoEvento: 'CORREO_REGISTRADO',
      comentario: `Correo recibido — ${origen}`,
      usuarioNombre: actor(),
      creadoEn: c.recibidoEn,
    });
    persist();
    return c;
  },

  enviarCorreo(
    operacionId: string,
    input: { destinatarioEmail: string; asunto: string; cuerpoTexto: string }
  ): { correoEnviado: CorreoEnviadoHbi; graphOk: boolean } {
    touchStore();
    const op = MockHbiStore.obtener(operacionId);
    if (!op) throw new Error('Operación no encontrada');
    const asunto = `[${op.codigoOperacion}] ${input.asunto}`;
    const ahora = new Date().toISOString();
    const ce: CorreoEnviadoHbi = {
      id: uid('mock-ce'),
      operacionId,
      codigoOperacion: op.codigoOperacion,
      tipo: 'HBI_OPERACION',
      estado: 'enviado',
      destinatarioEmail: input.destinatarioEmail,
      remitente: 'demo@hbi.com.ec',
      asunto,
      cuerpoTexto: input.cuerpoTexto,
      mensajeError: null,
      creadoEn: ahora,
    };
    store.correosEnviados.unshift(ce);
    store.correos.unshift({
      id: uid('mock-cor'),
      operacionId,
      remitente: ce.remitente ?? 'demo@hbi.com.ec',
      asunto,
      origen: 'AGENTE_HBI',
      prioridad: 'MEDIA',
      leido: true,
      recibidoEn: ahora,
      direccion: 'ENVIADO',
      destinatarioPrincipal: input.destinatarioEmail,
      cuerpoResumen: input.cuerpoTexto.slice(0, 500),
      correoEnviadoId: ce.id,
    });
    store.historial.unshift({
      id: uid('mock-h'),
      operacionId,
      tipoEvento: 'CORREO_ENVIADO',
      comentario: `Correo enviado a ${input.destinatarioEmail} (demo, sin Graph)`,
      usuarioNombre: actor(),
      creadoEn: ahora,
    });
    persist();
    return { correoEnviado: ce, graphOk: true };
  },

  actualizarActividad(actividadId: string, estado: ActividadServicio['estado']): ActividadServicio {
    touchStore();
    const act = store.actividades.find((a) => a.id === actividadId);
    if (!act) throw new Error('Actividad no encontrada');
    act.estado = estado;
    store.historial.unshift({
      id: uid('mock-h'),
      operacionId: act.operacionId,
      tipoEvento: 'ACTIVIDAD_ESTADO',
      comentario: `${act.titulo} → ${estado}`,
      usuarioNombre: actor(),
      creadoEn: new Date().toISOString(),
    });
    persist();
    return act;
  },
};
