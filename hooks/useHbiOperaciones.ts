'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { esModoDemo } from '@/lib/demo/app-mode';
import { MockHbiStore } from '@/lib/hbi/mock-store';
import type {
  ActividadServicio,
  CorreoEnviadoHbi,
  CorreoOperacion,
  DocumentoContractual,
  EstadoIntegralHbi,
  EventoTrazabilidad,
  FaseWorkflowHbi,
  OperacionCredito,
  OperacionVista360,
  OrigenCorreoHbi,
  PrioridadCorreoHbi,
  InfoProyectoHbi,
  PartesCreditoHbi,
  RegistroFaseHbi,
  TipoDocumentoContractual,
  TipoServicioHbi,
} from '@/types/hbi/operacion.types';
import { archivoADatosPreview } from '@/lib/hbi/documento-preview';
import type { HitoDesembolsoHbi } from '@/types/hbi/cliente.types';

const MOCK = esModoDemo();

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Error en la solicitud');
  }
  return json.data as T;
}

function delay<T>(data: T, ms = 280): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

export function useHbiOperaciones(fase?: FaseWorkflowHbi) {
  return useQuery({
    queryKey: ['hbi-operaciones', fase ?? 'all', MOCK],
    queryFn: () =>
      MOCK ? delay(MockHbiStore.listar(fase)) : fetchJson<OperacionCredito[]>(`/api/hbi/operaciones${fase ? `?fase=${fase}` : ''}`),
  });
}

export function useHbiOperacionVista360(id: string | undefined) {
  return useQuery({
    queryKey: ['hbi-operacion-360', id, MOCK],
    queryFn: () => {
      if (!id) throw new Error('Sin id');
      return MOCK
        ? delay(MockHbiStore.vista360(id))
        : fetchJson<OperacionVista360>(`/api/hbi/operaciones/${id}?vista360=true`);
    },
    enabled: Boolean(id),
  });
}

export function useHbiEstadoIntegral(id: string | undefined) {
  return useQuery({
    queryKey: ['hbi-estado-integral', id, MOCK],
    queryFn: () => {
      if (!id) throw new Error('Sin id');
      return MOCK
        ? delay(MockHbiStore.estadoIntegral(id))
        : fetchJson<EstadoIntegralHbi>(`/api/hbi/operaciones/${id}/estado-integral`);
    },
    enabled: Boolean(id),
  });
}

export function useHbiDocumentos(operacionId: string | undefined) {
  return useQuery({
    queryKey: ['hbi-documentos', operacionId, MOCK],
    queryFn: () => {
      if (!operacionId) return [];
      return MOCK
        ? delay(MockHbiStore.documentos(operacionId))
        : fetchJson<DocumentoContractual[]>(`/api/hbi/operaciones/${operacionId}/documentos`);
    },
    enabled: Boolean(operacionId),
  });
}

export function useHbiCorreos(operacionId: string | undefined) {
  return useQuery({
    queryKey: ['hbi-correos', operacionId, MOCK],
    queryFn: () => {
      if (!operacionId) return [];
      return MOCK
        ? delay(MockHbiStore.correos(operacionId))
        : fetchJson<CorreoOperacion[]>(`/api/hbi/operaciones/${operacionId}/correos`);
    },
    enabled: Boolean(operacionId),
  });
}

export function useHbiActividades(operacionId: string | undefined, tipo?: TipoServicioHbi) {
  return useQuery({
    queryKey: ['hbi-actividades', operacionId, tipo ?? 'all', MOCK],
    queryFn: () => {
      if (!operacionId) return [];
      return MOCK
        ? delay(MockHbiStore.actividades(operacionId, tipo))
        : fetchJson<ActividadServicio[]>(
            `/api/hbi/operaciones/${operacionId}/actividades${tipo ? `?tipoServicio=${tipo}` : ''}`
          );
    },
    enabled: Boolean(operacionId),
  });
}

function invalidateOperacion(qc: ReturnType<typeof useQueryClient>, operacionId: string) {
  qc.invalidateQueries({ queryKey: ['hbi-operaciones'] });
  qc.invalidateQueries({ queryKey: ['hbi-operacion-360', operacionId] });
  qc.invalidateQueries({ queryKey: ['hbi-estado-integral', operacionId] });
  qc.invalidateQueries({ queryKey: ['hbi-documentos', operacionId] });
  qc.invalidateQueries({ queryKey: ['hbi-correos', operacionId] });
  qc.invalidateQueries({ queryKey: ['hbi-correos-enviados', operacionId] });
  qc.invalidateQueries({ queryKey: ['hbi-trazabilidad', operacionId] });
  qc.invalidateQueries({ queryKey: ['hbi-actividades', operacionId] });
}

export function useHbiTrazabilidad(operacionId: string | undefined) {
  return useQuery({
    queryKey: ['hbi-trazabilidad', operacionId, MOCK],
    queryFn: () => {
      if (!operacionId) return { eventos: [], total: 0 };
      return MOCK
        ? delay(MockHbiStore.trazabilidad(operacionId))
        : fetchJson<{ eventos: EventoTrazabilidad[]; total: number }>(
            `/api/hbi/operaciones/${operacionId}/trazabilidad`
          );
    },
    enabled: Boolean(operacionId),
  });
}

export function useHbiCorreosEnviados(operacionId: string | undefined) {
  return useQuery({
    queryKey: ['hbi-correos-enviados', operacionId, MOCK],
    queryFn: () => {
      if (!operacionId) return { items: [], total: 0 };
      return MOCK
        ? delay(MockHbiStore.correosEnviados(operacionId))
        : fetchJson<{ items: CorreoEnviadoHbi[]; total: number }>(
            `/api/hbi/operaciones/${operacionId}/correos-enviados`
          );
    },
    enabled: Boolean(operacionId),
  });
}

export function useCrearOperacionHbi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      nombreCredito: string;
      descripcion?: string;
      deudor?: string;
      deudorId?: string;
      tipoCredito?: string;
      serviciosActivos: string[];
      estructuraFinanciera?: {
        montoTotal: number;
        moneda: 'USD' | 'COP';
        acreedores: Array<{
          id: string;
          razonSocial: string;
          porcentaje: number;
          montoComprometido: number;
        }>;
        montoComprometidoTotal: number;
      };
      hitosDesembolso?: HitoDesembolsoHbi[];
    }) => {
      if (MOCK) {
        return delay(
          MockHbiStore.crear({
            nombreCredito: body.nombreCredito,
            descripcion: body.descripcion,
            deudor: body.deudor,
            deudorId: body.deudorId,
            tipoCredito: body.tipoCredito,
            serviciosActivos: body.serviciosActivos as TipoServicioHbi[],
            estructuraFinanciera: body.estructuraFinanciera,
            hitosDesembolso: body.hitosDesembolso,
          })
        );
      }
      return fetchJson<OperacionCredito>('/api/hbi/operaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hbi-operaciones'] }),
    meta: { lockMessage: 'Creando operación de crédito…' },
  });
}

export function useAvanzarFaseHbi(operacionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { fase: FaseWorkflowHbi; comentario?: string }) => {
      if (MOCK) {
        return delay(MockHbiStore.avanzarFase(operacionId, body.fase));
      }
      return fetchJson<OperacionCredito>(`/api/hbi/operaciones/${operacionId}/fase`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => invalidateOperacion(qc, operacionId),
    meta: { lockMessage: 'Actualizando fase…' },
  });
}

export function useSubirDocumentoHbi(operacionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      if (MOCK) {
        const file = formData.get('file');
        const nombre = file instanceof File ? file.name : 'documento.pdf';
        const tipo = formData.get('tipoDocumento') as TipoDocumentoContractual | null;
        let extras: { previewDataUrl?: string; mimeType?: string; tamanoBytes?: number } | undefined;
        if (file instanceof File) {
          const preview = await archivoADatosPreview(file);
          extras = {
            previewDataUrl: preview.previewDataUrl || undefined,
            mimeType: preview.mimeType,
            tamanoBytes: preview.tamanoBytes,
          };
        }
        return delay(
          MockHbiStore.subirDocumento(operacionId, nombre, tipo ?? undefined, extras)
        );
      }
      return fetchJson<DocumentoContractual>(`/api/hbi/operaciones/${operacionId}/documentos`, {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: () => invalidateOperacion(qc, operacionId),
    meta: { lockMessage: 'Registrando documento…' },
  });
}

export function useActualizarTrazabilidadOperacionHbi(operacionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { partesCredito?: PartesCreditoHbi; fasesHistorial?: RegistroFaseHbi[] }) => {
      if (MOCK) {
        return delay(MockHbiStore.actualizarTrazabilidadOperacion(operacionId, body));
      }
      return fetchJson<OperacionCredito>(`/api/hbi/operaciones/${operacionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => invalidateOperacion(qc, operacionId),
    meta: { lockMessage: 'Guardando trazabilidad…' },
  });
}

export function useActualizarInfoProyectoHbi(operacionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: InfoProyectoHbi) => {
      if (MOCK) {
        return delay(MockHbiStore.actualizarInfoProyecto(operacionId, body));
      }
      return fetchJson<OperacionCredito>(`/api/hbi/operaciones/${operacionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ infoProyecto: body }),
      });
    },
    onSuccess: () => invalidateOperacion(qc, operacionId),
    meta: { lockMessage: 'Guardando ficha de proyecto…' },
  });
}

export function useRegistrarCorreoHbi(operacionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      remitente: string;
      asunto: string;
      cuerpoResumen?: string;
      origen?: string;
      prioridad?: string;
    }) => {
      if (MOCK) {
        return delay(
          MockHbiStore.registrarCorreo(operacionId, {
            remitente: body.remitente,
            asunto: body.asunto,
            cuerpoResumen: body.cuerpoResumen,
            origen: body.origen as OrigenCorreoHbi | undefined,
            prioridad: body.prioridad as PrioridadCorreoHbi | undefined,
          })
        );
      }
      return fetchJson<CorreoOperacion>(`/api/hbi/operaciones/${operacionId}/correos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => invalidateOperacion(qc, operacionId),
    meta: { lockMessage: 'Registrando correo…' },
  });
}

export function useEnviarCorreoHbi(operacionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { destinatarioEmail: string; asunto: string; cuerpoTexto: string }) => {
      if (MOCK) {
        return delay(MockHbiStore.enviarCorreo(operacionId, body));
      }
      return fetchJson<{ correoEnviado: CorreoEnviadoHbi; graphOk: boolean }>(
        `/api/hbi/operaciones/${operacionId}/correos-enviados`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
    },
    onSuccess: () => invalidateOperacion(qc, operacionId),
    meta: { lockMessage: 'Enviando correo (demo)…' },
  });
}

export function useActualizarActividadHbi(operacionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { actividadId: string; estado: string }) => {
      if (MOCK) {
        return delay(
          MockHbiStore.actualizarActividad(
            input.actividadId,
            input.estado as ActividadServicio['estado']
          )
        );
      }
      return fetchJson<ActividadServicio>(
        `/api/hbi/operaciones/${operacionId}/actividades/${input.actividadId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: input.estado }),
        }
      );
    },
    onSuccess: () => invalidateOperacion(qc, operacionId),
    meta: { lockMessage: 'Actualizando actividad…' },
  });
}
