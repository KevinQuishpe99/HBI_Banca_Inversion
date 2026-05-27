import { query } from '@/lib/db';
import { calcularAvancePorAnexo, validarAvanceFase } from '@/lib/hbi/workflow-rules';
import { construirResumenExpediente } from '@/lib/hbi/sync-expediente';
import type {
  FaseWorkflowHbi,
  TipoDocumentoContractual,
  TipoServicioHbi,
} from '@/types/hbi/operacion.types';

export interface EstadoIntegralHbi {
  faseActual: FaseWorkflowHbi;
  proximosPasos: string;
  alertasActivas: boolean;
  avanceGlobal: number;
  avancePorAnexo: Record<
    string,
    { total: number; completadas: number; porcentaje: number }
  >;
  requisitosFase: Array<{
    codigo: string;
    descripcion: string;
    cumplido: boolean;
    obligatorio: boolean;
  }>;
  puedeAvanzarFase: boolean;
  mensajeAvance?: string;
}

const PLANTILLAS_ACTIVIDAD: Record<
  TipoServicioHbi,
  Array<{ titulo: string; descripcion: string; orden: number }>
> = {
  ANEXO_1_ADMINISTRATIVO: [
    { titulo: 'Validar documentación administrativa', descripcion: 'Anexo 1', orden: 1 },
    { titulo: 'Coordinación con agente y acreedores', descripcion: 'Anexo 1', orden: 2 },
    { titulo: 'Reporte de estado administrativo', descripcion: 'Anexo 1', orden: 3 },
  ],
  ANEXO_2_GARANTIAS: [
    { titulo: 'Revisión de garantías vigentes', descripcion: 'Anexo 2', orden: 1 },
    { titulo: 'Actualización de matrices de garantía', descripcion: 'Anexo 2', orden: 2 },
    { titulo: 'Certificación de cumplimiento', descripcion: 'Anexo 2', orden: 3 },
  ],
  ANEXO_3_CALCULO: [
    { titulo: 'Cálculo de cuotas y cronograma', descripcion: 'Anexo 3', orden: 1 },
    { titulo: 'Validación de tasas y spreads', descripcion: 'Anexo 3', orden: 2 },
    { titulo: 'Entrega de reporte de cálculo', descripcion: 'Anexo 3', orden: 3 },
  ],
};

export class MotorOperativoService {
  /** Recalcula expediente, próximos pasos y alertas (desde el primer momento). */
  static async sincronizarOperacion(operacionId: string): Promise<void> {
    const op = await query<{
      id: string;
      codigo_operacion: string;
      nombre_credito: string;
      deudor: string | null;
      servicios_activos: TipoServicioHbi[];
      fase_actual: FaseWorkflowHbi;
      responsable_id: string | null;
    }>(
      `SELECT id, codigo_operacion, nombre_credito, deudor, servicios_activos, fase_actual, responsable_id
       FROM operaciones_credito WHERE id = $1`,
      [operacionId]
    );
    const row = op.rows[0];
    if (!row) return;

    const [docs, correos] = await Promise.all([
      query<{ id: string; tipo_documento: TipoDocumentoContractual; nombre_archivo: string; datos_extraidos: Record<string, unknown> }>(
        `SELECT id, tipo_documento, nombre_archivo, datos_extraidos FROM documentos_contractuales WHERE operacion_id = $1`,
        [operacionId]
      ),
      query<{ id: string; origen: string; prioridad: string; leido: boolean; recibido_en: string; asunto: string; remitente: string }>(
        `SELECT id, origen, prioridad, leido, recibido_en, asunto, remitente FROM correos_operacion
         WHERE operacion_id = $1 ORDER BY recibido_en DESC`,
        [operacionId]
      ),
    ]);

    const expediente = construirResumenExpediente({
      codigoOperacion: row.codigo_operacion,
      nombreCredito: row.nombre_credito,
      deudor: row.deudor ?? undefined,
      documentos: docs.rows.map((d) => ({
        id: d.id,
        operacionId,
        tipoDocumento: d.tipo_documento,
        nombreArchivo: d.nombre_archivo,
        datosExtraidos: d.datos_extraidos ?? {},
        creadoEn: '',
      })),
      correos: correos.rows.map((c) => ({
        id: c.id,
        operacionId,
        remitente: c.remitente,
        asunto: c.asunto,
        origen: c.origen as 'AGENTE_HBI',
        prioridad: c.prioridad as 'MEDIA',
        leido: c.leido,
        recibidoEn: c.recibido_en,
      })),
      serviciosActivos: row.servicios_activos ?? [],
    });

    const estado = await this.calcularEstadoIntegral(operacionId);

    await query(
      `UPDATE expediente_maestro SET
        resumen_contractual = $2,
        cronogramas = $3,
        comunicaciones_resumen = $4,
        alertas = $5,
        actualizado_en = CURRENT_TIMESTAMP,
        consolidado_en = COALESCE(consolidado_en, CURRENT_TIMESTAMP)
       WHERE operacion_id = $1`,
      [
        operacionId,
        JSON.stringify(expediente.resumenContractual),
        JSON.stringify(expediente.cronogramas),
        JSON.stringify(expediente.comunicacionesResumen),
        JSON.stringify(expediente.alertas),
      ]
    );

    await query(
      `UPDATE operaciones_credito SET proximos_pasos = $2, alertas_activas = $3 WHERE id = $1`,
      [operacionId, estado.proximosPasos, estado.alertasActivas]
    );
  }

  static async calcularEstadoIntegral(operacionId: string): Promise<EstadoIntegralHbi> {
    const op = await query<{
      fase_actual: FaseWorkflowHbi;
      servicios_activos: TipoServicioHbi[];
      responsable_id: string | null;
      proximos_pasos: string | null;
    }>(
      `SELECT fase_actual, servicios_activos, responsable_id, proximos_pasos FROM operaciones_credito WHERE id = $1`,
      [operacionId]
    );
    const row = op.rows[0];
    if (!row) {
      throw new Error('Operación no encontrada');
    }

    const docs = await query<{ tipo_documento: TipoDocumentoContractual }>(
      `SELECT tipo_documento FROM documentos_contractuales WHERE operacion_id = $1`,
      [operacionId]
    );
    const correos = await query<{ prioridad: string; leido: boolean }>(
      `SELECT prioridad, leido FROM correos_operacion WHERE operacion_id = $1`,
      [operacionId]
    );
    const act = await query<{ tipo_servicio: TipoServicioHbi; estado: string }>(
      `SELECT tipo_servicio, estado FROM actividades_servicio WHERE operacion_id = $1`,
      [operacionId]
    );

    const servicios = row.servicios_activos ?? [];
    const avancePorAnexo = calcularAvancePorAnexo(
      servicios,
      act.rows.map((a) => ({ tipoServicio: a.tipo_servicio, estado: a.estado }))
    );
    const totalAct = act.rows.length;
    const completadas = act.rows.filter((a) => a.estado === 'COMPLETADA').length;
    const avanceGlobal =
      row.fase_actual === 'FASE_4_SEGUIMIENTO' && totalAct > 0
        ? Math.round((completadas / totalAct) * 100)
        : ORDEN_FASE_PORCENTAJE[row.fase_actual];

    const idx = ORDEN_FASES.indexOf(row.fase_actual);
    const siguiente = idx < ORDEN_FASES.length - 1 ? ORDEN_FASES[idx + 1] : null;

    const validacion = siguiente
      ? validarAvanceFase({
          faseActual: row.fase_actual,
          faseDestino: siguiente,
          totalDocumentos: docs.rows.length,
          tiposDocumento: docs.rows.map((d) => d.tipo_documento),
          totalCorreos: correos.rows.length,
          correosUrgentes: correos.rows.filter((c) => c.prioridad === 'URGENTE' && !c.leido).length,
          serviciosActivos: servicios,
          totalActividades: totalAct,
          actividadesCompletadas: completadas,
          tieneResponsable: Boolean(row.responsable_id),
        })
      : { permitido: false, requisitos: [], mensaje: 'Fase final alcanzada' };

    const proximosPasos = generarProximosPasos(
      row.fase_actual,
      validacion.requisitos,
      act.rows,
      correos.rows.filter((c) => c.prioridad === 'URGENTE' && !c.leido).length
    );

    const alertasActivas =
      correos.rows.some((c) => c.prioridad === 'URGENTE' && !c.leido) ||
      act.rows.some((a) => a.estado === 'BLOQUEADA');

    return {
      faseActual: row.fase_actual,
      proximosPasos,
      alertasActivas,
      avanceGlobal,
      avancePorAnexo,
      requisitosFase: validacion.requisitos,
      puedeAvanzarFase: validacion.permitido,
      mensajeAvance: validacion.mensaje,
    };
  }

  /** Inicializa actividades del motor operativo al entrar en Fase 4. */
  static async inicializarActividadesFase4(operacionId: string): Promise<number> {
    const op = await query<{ servicios_activos: TipoServicioHbi[] }>(
      `SELECT servicios_activos FROM operaciones_credito WHERE id = $1`,
      [operacionId]
    );
    const servicios = op.rows[0]?.servicios_activos ?? [];
    let creadas = 0;

    for (const servicio of servicios) {
      const existe = await query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM actividades_servicio WHERE operacion_id = $1 AND tipo_servicio = $2`,
        [operacionId, servicio]
      );
      if ((existe.rows[0]?.n ?? 0) > 0) continue;

      const plantillas = PLANTILLAS_ACTIVIDAD[servicio];
      for (const p of plantillas) {
        await query(
          `INSERT INTO actividades_servicio (operacion_id, tipo_servicio, titulo, descripcion, orden)
           VALUES ($1, $2, $3, $4, $5)`,
          [operacionId, servicio, p.titulo, p.descripcion, p.orden]
        );
        creadas++;
      }
    }
    return creadas;
  }
}

const ORDEN_FASES: FaseWorkflowHbi[] = [
  'FASE_1_CONTRATOS',
  'FASE_2_CORREOS',
  'FASE_3_EXPEDIENTE',
  'FASE_4_SEGUIMIENTO',
];

const ORDEN_FASE_PORCENTAJE: Record<FaseWorkflowHbi, number> = {
  FASE_1_CONTRATOS: 25,
  FASE_2_CORREOS: 50,
  FASE_3_EXPEDIENTE: 75,
  FASE_4_SEGUIMIENTO: 100,
};

function generarProximosPasos(
  fase: FaseWorkflowHbi,
  requisitos: Array<{ descripcion: string; cumplido: boolean; obligatorio: boolean }>,
  actividades: Array<{ estado: string }>,
  correosUrgentes: number
): string {
  const pendientes = requisitos.filter((r) => r.obligatorio && !r.cumplido);
  if (pendientes.length > 0) {
    return pendientes.map((r) => r.descripcion).join(' · ');
  }

  if (correosUrgentes > 0) {
    return `Revisar ${correosUrgentes} correo(s) urgente(s) en la bandeja de la operación.`;
  }

  const actPend = actividades.filter((a) => a.estado === 'PENDIENTE' || a.estado === 'EN_PROGRESO');
  if (fase === 'FASE_4_SEGUIMIENTO' && actPend.length > 0) {
    return `Completar ${actPend.length} actividad(es) pendiente(s) del motor operativo por anexo.`;
  }

  const mensajes: Record<FaseWorkflowHbi, string> = {
    FASE_1_CONTRATOS: 'Cargar y clasificar el paquete contractual completo (Anexos 1, 2 y 3 según aplique).',
    FASE_2_CORREOS: 'Registrar correos de Agente–HBI, Deudor y Acreedores en la bandeja única.',
    FASE_3_EXPEDIENTE: 'Consolidar expediente maestro y validar vista 360 antes del seguimiento recurrente.',
    FASE_4_SEGUIMIENTO: 'Operación en motor recurrente — mantener actividades por servicio al día.',
  };
  return mensajes[fase];
}
