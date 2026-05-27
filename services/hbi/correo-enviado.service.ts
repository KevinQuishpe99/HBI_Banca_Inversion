import { query } from '@/lib/db';
import { sendMailApplication } from '@/lib/email/graph-mail';
import { detectarPrioridadCorreo } from '@/lib/hbi/detect-email-origin';
import { MotorOperativoService } from '@/services/hbi/motor-operativo.service';
import { TrazabilidadHbiService } from '@/services/hbi/trazabilidad.service';
import type { CorreoEnviadoHbi, OrigenCorreoHbi } from '@/types/hbi/operacion.types';
import { ValidationError } from '@/lib/utils/errors';

export class CorreoEnviadoHbiService {
  static async listar(operacionId: string): Promise<CorreoEnviadoHbi[]> {
    return TrazabilidadHbiService.listarCorreosEnviados(operacionId);
  }

  /**
   * Envía correo vía Graph, audita en correos_enviados y refleja en bandeja (ENVIADO) + historial.
   */
  static async enviarDesdeOperacion(input: {
    operacionId: string;
    codigoOperacion: string;
    destinatarioEmail: string;
    asunto: string;
    cuerpoTexto: string;
    usuarioId: string;
    origen?: OrigenCorreoHbi;
  }): Promise<{ correoEnviado: CorreoEnviadoHbi; graphOk: boolean }> {
    const asunto = `[${input.codigoOperacion}] ${input.asunto}`.slice(0, 500);
    const origen = input.origen ?? 'AGENTE_HBI';
    const prioridad = detectarPrioridadCorreo(asunto, input.cuerpoTexto);

    let graphOk = false;
    let mensajeError: string | null = null;

    try {
      await sendMailApplication({
        to: input.destinatarioEmail,
        subject: asunto,
        bodyText: input.cuerpoTexto,
        logMeta: {
          tipo: 'HBI_OPERACION',
          operacionId: input.operacionId,
          codigoOperacion: input.codigoOperacion,
        },
      });
      graphOk = true;
    } catch (e) {
      mensajeError = e instanceof Error ? e.message : String(e);
      if (!(e instanceof ValidationError)) {
        throw e;
      }
    }

    const from = process.env.MAIL_FROM_ADDRESS?.trim() ?? 'sistema@hbi';

    const ultimo = await query<{ id: string }>(
      `SELECT id FROM correos_enviados
       WHERE destinatario_email = $1 AND asunto = $2
       ORDER BY creado_en DESC LIMIT 1`,
      [input.destinatarioEmail, asunto]
    );
    const correoEnviadoId = ultimo.rows[0]?.id ?? null;

    await query(
      `INSERT INTO correos_operacion (
        operacion_id, remitente, destinatarios, asunto, cuerpo_resumen,
        origen, prioridad, direccion, destinatario_principal, correo_enviado_id, enviado_por
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,'ENVIADO',$8,$9,$10)`,
      [
        input.operacionId,
        from,
        [input.destinatarioEmail],
        asunto,
        input.cuerpoTexto.slice(0, 2000),
        origen,
        prioridad,
        input.destinatarioEmail,
        correoEnviadoId,
        input.usuarioId,
      ]
    ).catch(() => {
      /* migración direccion pendiente: solo historial */
    });

    await query(
      `INSERT INTO historial_operacion (operacion_id, usuario_id, tipo_evento, detalle, comentario)
       VALUES ($1,$2,'CORREO_ENVIADO',$3,$4)`,
      [
        input.operacionId,
        input.usuarioId,
        JSON.stringify({
          destinatario: input.destinatarioEmail,
          asunto,
          estado: graphOk ? 'enviado' : 'fallido',
        }),
        `Correo enviado a ${input.destinatarioEmail}${graphOk ? '' : ' (fallido)'}`,
      ]
    );

    await MotorOperativoService.sincronizarOperacion(input.operacionId);

    const lista = await TrazabilidadHbiService.listarCorreosEnviados(input.operacionId);
    const correoEnviado = lista[0] ?? {
      id: correoEnviadoId ?? '',
      operacionId: input.operacionId,
      codigoOperacion: input.codigoOperacion,
      tipo: 'HBI_OPERACION',
      estado: graphOk ? 'enviado' : 'fallido',
      destinatarioEmail: input.destinatarioEmail,
      remitente: from,
      asunto,
      cuerpoTexto: input.cuerpoTexto,
      mensajeError,
      creadoEn: new Date().toISOString(),
    };

    return { correoEnviado, graphOk };
  }
}
