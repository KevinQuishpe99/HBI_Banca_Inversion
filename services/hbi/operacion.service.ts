import { query } from '@/lib/db';
import { ValidationError } from '@/lib/utils/errors';
import { validarAvanceFase } from '@/lib/hbi/workflow-rules';
import { MotorOperativoService } from '@/services/hbi/motor-operativo.service';
import type {
  TipoDocumentoContractual,
  ActividadServicio,
  CorreoOperacion,
  DocumentoContractual,
  ExpedienteMaestro,
  FaseWorkflowHbi,
  OperacionCredito,
  OperacionVista360,
  TipoServicioHbi,
} from '@/types/hbi/operacion.types';

type OperacionRow = {
  id: string;
  codigo_operacion: string;
  nombre_credito: string;
  descripcion: string | null;
  deudor: string | null;
  agente_financiacion: string;
  fase_actual: FaseWorkflowHbi;
  servicios_activos: TipoServicioHbi[];
  responsable_id: string | null;
  creado_por: string;
  metadata: Record<string, unknown>;
  alertas_activas: boolean;
  proximos_pasos: string | null;
  creado_en: string;
  actualizado_en: string;
  cerrado_en: string | null;
};

function mapOperacion(row: OperacionRow): OperacionCredito {
  return {
    id: row.id,
    codigoOperacion: row.codigo_operacion,
    nombreCredito: row.nombre_credito,
    descripcion: row.descripcion ?? undefined,
    deudor: row.deudor ?? undefined,
    agenteFinanciacion: row.agente_financiacion,
    faseActual: row.fase_actual,
    serviciosActivos: row.servicios_activos ?? [],
    responsableId: row.responsable_id ?? undefined,
    creadoPor: row.creado_por,
    metadata: row.metadata ?? {},
    alertasActivas: row.alertas_activas,
    proximosPasos: row.proximos_pasos ?? undefined,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
    cerradoEn: row.cerrado_en ?? undefined,
  };
}

export class OperacionService {
  static async listar(fase?: FaseWorkflowHbi): Promise<OperacionCredito[]> {
    const params: string[] = [];
    let where = '';
    if (fase) {
      where = ' WHERE fase_actual = $1';
      params.push(fase);
    }
    const result = await query<OperacionRow>(
      `SELECT * FROM operaciones_credito${where} ORDER BY actualizado_en DESC`,
      params
    );
    return result.rows.map(mapOperacion);
  }

  static async obtenerPorId(id: string): Promise<OperacionCredito | null> {
    const result = await query<OperacionRow>(
      `SELECT * FROM operaciones_credito WHERE id = $1 LIMIT 1`,
      [id]
    );
    const row = result.rows[0];
    return row ? mapOperacion(row) : null;
  }

  static async crear(input: {
    nombreCredito: string;
    descripcion?: string;
    deudor?: string;
    serviciosActivos: TipoServicioHbi[];
    creadoPor: string;
    responsableId?: string;
  }): Promise<OperacionCredito> {
    const codigoResult = await query<{ codigo: string }>(
      `SELECT generar_codigo_operacion_hbi() AS codigo`
    );
    const codigo = codigoResult.rows[0]?.codigo ?? `CRED-${Date.now()}`;

    const insert = await query<OperacionRow>(
      `INSERT INTO operaciones_credito (
        codigo_operacion, nombre_credito, descripcion, deudor,
        servicios_activos, creado_por, responsable_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        codigo,
        input.nombreCredito,
        input.descripcion ?? null,
        input.deudor ?? null,
        input.serviciosActivos,
        input.creadoPor,
        input.responsableId ?? null,
      ]
    );

    const operacion = mapOperacion(insert.rows[0]);

    await query(
      `INSERT INTO expediente_maestro (operacion_id) VALUES ($1)`,
      [operacion.id]
    );

    await query(
      `INSERT INTO historial_operacion (operacion_id, usuario_id, tipo_evento, fase_nueva, comentario)
       VALUES ($1, $2, 'CREACION', 'FASE_1_CONTRATOS', $3)`,
      [operacion.id, input.creadoPor, 'Operación creada — inicio Fase 1']
    );

    await MotorOperativoService.sincronizarOperacion(operacion.id);
    return operacion;
  }

  static async avanzarFase(
    operacionId: string,
    nuevaFase: FaseWorkflowHbi,
    usuarioId: string,
    comentario?: string
  ): Promise<OperacionCredito | null> {
    const actual = await this.obtenerPorId(operacionId);
    if (!actual) return null;

    const [docs, correos, act] = await Promise.all([
      query<{ tipo_documento: TipoDocumentoContractual }>(
        `SELECT tipo_documento FROM documentos_contractuales WHERE operacion_id = $1`,
        [operacionId]
      ),
      query<{ prioridad: string; leido: boolean }>(
        `SELECT prioridad, leido FROM correos_operacion WHERE operacion_id = $1`,
        [operacionId]
      ),
      query<{ estado: string }>(
        `SELECT estado FROM actividades_servicio WHERE operacion_id = $1`,
        [operacionId]
      ),
    ]);

    const validacion = validarAvanceFase({
      faseActual: actual.faseActual,
      faseDestino: nuevaFase,
      totalDocumentos: docs.rows.length,
      tiposDocumento: docs.rows.map((d) => d.tipo_documento),
      totalCorreos: correos.rows.length,
      correosUrgentes: correos.rows.filter((c) => c.prioridad === 'URGENTE' && !c.leido).length,
      serviciosActivos: actual.serviciosActivos,
      totalActividades: act.rows.length,
      actividadesCompletadas: act.rows.filter((a) => a.estado === 'COMPLETADA').length,
      tieneResponsable: Boolean(actual.responsableId),
    });

    if (!validacion.permitido) {
      throw new ValidationError(validacion.mensaje ?? 'No se cumplen los requisitos para avanzar de fase');
    }

    const upd = await query<OperacionRow>(
      `UPDATE operaciones_credito SET fase_actual = $2 WHERE id = $1 RETURNING *`,
      [operacionId, nuevaFase]
    );

    await query(
      `INSERT INTO historial_operacion (
        operacion_id, usuario_id, tipo_evento, fase_anterior, fase_nueva, comentario
      ) VALUES ($1, $2, 'CAMBIO_FASE', $3, $4, $5)`,
      [operacionId, usuarioId, actual.faseActual, nuevaFase, comentario ?? null]
    );

    if (nuevaFase === 'FASE_4_SEGUIMIENTO') {
      await MotorOperativoService.inicializarActividadesFase4(operacionId);
    }

    await MotorOperativoService.sincronizarOperacion(operacionId);
    return mapOperacion(upd.rows[0]);
  }

  static async vista360(operacionId: string): Promise<OperacionVista360 | null> {
    const operacion = await this.obtenerPorId(operacionId);
    if (!operacion) return null;

    const [docs, correos, exp, act, hist] = await Promise.all([
      query<DocumentoContractual & { operacion_id: string }>(
        `SELECT id, operacion_id AS "operacionId", tipo_documento AS "tipoDocumento",
                nombre_archivo AS "nombreArchivo", mime_type AS "mimeType",
                tamano_bytes AS "tamanoBytes", blob_url AS "blobUrl",
                datos_extraidos AS "datosExtraidos", creado_en AS "creadoEn"
         FROM documentos_contractuales WHERE operacion_id = $1 ORDER BY creado_en DESC`,
        [operacionId]
      ),
      query<CorreoOperacion & { operacion_id: string }>(
        `SELECT id, operacion_id AS "operacionId", remitente, asunto, origen, prioridad,
                leido, recibido_en AS "recibidoEn"
         FROM correos_operacion WHERE operacion_id = $1 ORDER BY recibido_en DESC LIMIT 50`,
        [operacionId]
      ),
      query<{
        id: string;
        operacion_id: string;
        resumen_contractual: Record<string, unknown>;
        cronogramas: unknown[];
        responsables: unknown[];
        comunicaciones_resumen: Record<string, unknown>;
        alertas: unknown[];
        consolidado_en: string | null;
      }>(`SELECT * FROM expediente_maestro WHERE operacion_id = $1 LIMIT 1`, [operacionId]),
      query<ActividadServicio & { operacion_id: string }>(
        `SELECT id, operacion_id AS "operacionId", tipo_servicio AS "tipoServicio",
                titulo, descripcion, estado, orden, fecha_limite AS "fechaLimite",
                asignado_a AS "asignadoA"
         FROM actividades_servicio WHERE operacion_id = $1 ORDER BY tipo_servicio, orden`,
        [operacionId]
      ),
      query<{ tipo_evento: string; comentario: string | null; creado_en: string }>(
        `SELECT tipo_evento, comentario, creado_en FROM historial_operacion
         WHERE operacion_id = $1 ORDER BY creado_en DESC LIMIT 20`,
        [operacionId]
      ),
    ]);

    const expRow = exp.rows[0];
    const expediente: ExpedienteMaestro | undefined = expRow
      ? {
          id: expRow.id,
          operacionId: expRow.operacion_id,
          resumenContractual: expRow.resumen_contractual ?? {},
          cronogramas: expRow.cronogramas ?? [],
          responsables: expRow.responsables ?? [],
          comunicacionesResumen: expRow.comunicaciones_resumen ?? {},
          alertas: expRow.alertas ?? [],
          consolidadoEn: expRow.consolidado_en ?? undefined,
        }
      : undefined;

    return {
      ...operacion,
      documentos: docs.rows as DocumentoContractual[],
      correos: correos.rows as CorreoOperacion[],
      expediente,
      actividades: act.rows as ActividadServicio[],
      historialReciente: hist.rows.map((h) => ({
        tipoEvento: h.tipo_evento,
        comentario: h.comentario ?? undefined,
        creadoEn: h.creado_en,
      })),
    };
  }
}
