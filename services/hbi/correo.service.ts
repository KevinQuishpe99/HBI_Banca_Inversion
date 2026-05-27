import { query } from '@/lib/db';
import { detectarOrigenCorreo, detectarPrioridadCorreo } from '@/lib/hbi/detect-email-origin';
import { MotorOperativoService } from '@/services/hbi/motor-operativo.service';
import type { CorreoOperacion, OrigenCorreoHbi, PrioridadCorreoHbi } from '@/types/hbi/operacion.types';

type CorreoRow = {
  id: string;
  operacion_id: string;
  remitente: string;
  asunto: string;
  origen: OrigenCorreoHbi;
  prioridad: PrioridadCorreoHbi;
  leido: boolean;
  cuerpo_resumen: string | null;
  recibido_en: string;
  direccion?: string;
  destinatario_principal?: string | null;
  correo_enviado_id?: string | null;
};

function mapCorreo(row: CorreoRow): CorreoOperacion {
  return {
    id: row.id,
    operacionId: row.operacion_id,
    remitente: row.remitente,
    asunto: row.asunto,
    origen: row.origen,
    prioridad: row.prioridad,
    leido: row.leido,
    recibidoEn: row.recibido_en,
    direccion: (row.direccion as 'RECIBIDO' | 'ENVIADO') ?? 'RECIBIDO',
    destinatarioPrincipal: row.destinatario_principal ?? undefined,
    cuerpoResumen: row.cuerpo_resumen ?? undefined,
    correoEnviadoId: row.correo_enviado_id ?? undefined,
  };
}

export class CorreoHbiService {
  static async listar(operacionId: string): Promise<CorreoOperacion[]> {
    const r = await query<CorreoRow>(
      `SELECT id, operacion_id, remitente, asunto, origen, prioridad, leido, cuerpo_resumen,
              recibido_en, COALESCE(direccion, 'RECIBIDO') AS direccion,
              destinatario_principal, correo_enviado_id
       FROM correos_operacion WHERE operacion_id = $1 ORDER BY recibido_en DESC`,
      [operacionId]
    );
    return r.rows.map(mapCorreo);
  }

  static async registrar(input: {
    operacionId: string;
    remitente: string;
    asunto: string;
    cuerpoResumen?: string;
    origen?: OrigenCorreoHbi;
    prioridad?: PrioridadCorreoHbi;
    usuarioId: string;
  }): Promise<CorreoOperacion> {
    const origen =
      input.origen ?? detectarOrigenCorreo(input.remitente, input.asunto);
    const prioridad =
      input.prioridad ?? detectarPrioridadCorreo(input.asunto, input.cuerpoResumen);

    let ins;
    try {
      ins = await query<CorreoRow>(
        `INSERT INTO correos_operacion (
          operacion_id, remitente, asunto, cuerpo_resumen, origen, prioridad, direccion
        ) VALUES ($1,$2,$3,$4,$5,$6,'RECIBIDO')
        RETURNING id, operacion_id, remitente, asunto, origen, prioridad, leido, cuerpo_resumen,
                  recibido_en, direccion, destinatario_principal, correo_enviado_id`,
        [
          input.operacionId,
          input.remitente,
          input.asunto,
          input.cuerpoResumen ?? null,
          origen,
          prioridad,
        ]
      );
    } catch {
      ins = await query<CorreoRow>(
        `INSERT INTO correos_operacion (
          operacion_id, remitente, asunto, cuerpo_resumen, origen, prioridad
        ) VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING id, operacion_id, remitente, asunto, origen, prioridad, leido, cuerpo_resumen,
                  recibido_en`,
        [
          input.operacionId,
          input.remitente,
          input.asunto,
          input.cuerpoResumen ?? null,
          origen,
          prioridad,
        ]
      );
    }

    await query(
      `INSERT INTO historial_operacion (operacion_id, usuario_id, tipo_evento, detalle, comentario)
       VALUES ($1, $2, 'CORREO_REGISTRADO', $3, $4)`,
      [
        input.operacionId,
        input.usuarioId,
        JSON.stringify({ origen, prioridad, asunto: input.asunto }),
        `Correo registrado — ${origen}`,
      ]
    );

    await MotorOperativoService.sincronizarOperacion(input.operacionId);
    return mapCorreo(ins.rows[0]);
  }

  static async marcarLeido(correoId: string, operacionId: string): Promise<void> {
    await query(`UPDATE correos_operacion SET leido = true WHERE id = $1 AND operacion_id = $2`, [
      correoId,
      operacionId,
    ]);
    await MotorOperativoService.sincronizarOperacion(operacionId);
  }
}
