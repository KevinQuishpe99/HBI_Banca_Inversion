import { query } from '@/lib/db';
import { MotorOperativoService } from '@/services/hbi/motor-operativo.service';
import type { ActividadServicio, EstadoActividadHbi, TipoServicioHbi } from '@/types/hbi/operacion.types';

type ActRow = {
  id: string;
  operacion_id: string;
  tipo_servicio: TipoServicioHbi;
  titulo: string;
  descripcion: string | null;
  estado: EstadoActividadHbi;
  orden: number;
  fecha_limite: string | null;
  asignado_a: string | null;
};

function mapAct(row: ActRow): ActividadServicio {
  return {
    id: row.id,
    operacionId: row.operacion_id,
    tipoServicio: row.tipo_servicio,
    titulo: row.titulo,
    descripcion: row.descripcion ?? undefined,
    estado: row.estado,
    orden: row.orden,
    fechaLimite: row.fecha_limite ?? undefined,
    asignadoA: row.asignado_a ?? undefined,
  };
}

export class ActividadHbiService {
  static async listar(operacionId: string, tipoServicio?: TipoServicioHbi): Promise<ActividadServicio[]> {
    const params: string[] = [operacionId];
    let where = ' WHERE operacion_id = $1';
    if (tipoServicio) {
      where += ' AND tipo_servicio = $2';
      params.push(tipoServicio);
    }
    const r = await query<ActRow>(
      `SELECT * FROM actividades_servicio${where} ORDER BY tipo_servicio, orden`,
      params
    );
    return r.rows.map(mapAct);
  }

  static async crear(input: {
    operacionId: string;
    tipoServicio: TipoServicioHbi;
    titulo: string;
    descripcion?: string;
    fechaLimite?: string;
    asignadoA?: string;
    usuarioId: string;
  }): Promise<ActividadServicio> {
    const maxOrden = await query<{ m: number }>(
      `SELECT COALESCE(MAX(orden),0)::int AS m FROM actividades_servicio
       WHERE operacion_id = $1 AND tipo_servicio = $2`,
      [input.operacionId, input.tipoServicio]
    );
    const orden = (maxOrden.rows[0]?.m ?? 0) + 1;

    const ins = await query<ActRow>(
      `INSERT INTO actividades_servicio (
        operacion_id, tipo_servicio, titulo, descripcion, orden, fecha_limite, asignado_a
      ) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        input.operacionId,
        input.tipoServicio,
        input.titulo,
        input.descripcion ?? null,
        orden,
        input.fechaLimite ?? null,
        input.asignadoA ?? null,
      ]
    );

    await query(
      `INSERT INTO historial_operacion (operacion_id, usuario_id, tipo_evento, detalle, comentario)
       VALUES ($1,$2,'ACTIVIDAD_CREADA',$3,$4)`,
      [
        input.operacionId,
        input.usuarioId,
        JSON.stringify({ tipoServicio: input.tipoServicio, titulo: input.titulo }),
        `Actividad creada — ${input.tipoServicio}`,
      ]
    );

    await MotorOperativoService.sincronizarOperacion(input.operacionId);
    return mapAct(ins.rows[0]);
  }

  static async actualizarEstado(
    actividadId: string,
    operacionId: string,
    estado: EstadoActividadHbi,
    usuarioId: string
  ): Promise<ActividadServicio> {
    const completada = estado === 'COMPLETADA' ? ', completada_en = CURRENT_TIMESTAMP' : '';
    const r = await query<ActRow>(
      `UPDATE actividades_servicio SET estado = $3${completada} WHERE id = $1 AND operacion_id = $2 RETURNING *`,
      [actividadId, operacionId, estado]
    );
    if (!r.rows[0]) throw new Error('Actividad no encontrada');

    await query(
      `INSERT INTO historial_operacion (operacion_id, usuario_id, tipo_evento, detalle)
       VALUES ($1,$2,'ACTIVIDAD_ESTADO',$3)`,
      [operacionId, usuarioId, JSON.stringify({ actividadId, estado })]
    );

    await MotorOperativoService.sincronizarOperacion(operacionId);
    return mapAct(r.rows[0]);
  }
}
