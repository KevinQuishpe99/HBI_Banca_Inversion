'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { esModoDemo } from '@/lib/demo/app-mode';
import { MockHbiStore } from '@/lib/hbi/mock-store';
import type { EvidenciaDesembolsoHbi, HitoDesembolsoHbi } from '@/types/hbi/cliente.types';

const MOCK = esModoDemo();

function delay<T>(data: T, ms = 260): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

function invalidateDesembolsos(qc: ReturnType<typeof useQueryClient>, operacionId: string) {
  void qc.invalidateQueries({ queryKey: ['hbi-hitos', operacionId] });
  void qc.invalidateQueries({ queryKey: ['hbi-operacion-360', operacionId] });
  void qc.invalidateQueries({ queryKey: ['hbi-operaciones'] });
  void qc.invalidateQueries({ queryKey: ['hbi-estado-integral', operacionId] });
  void qc.invalidateQueries({ queryKey: ['hbi-trazabilidad', operacionId] });
}

export function useHbiHitos(operacionId: string | undefined) {
  return useQuery({
    queryKey: ['hbi-hitos', operacionId, MOCK],
    queryFn: () => {
      if (!operacionId) return [];
      return MOCK ? delay(MockHbiStore.obtenerHitos(operacionId)) : Promise.reject(new Error('Solo demo'));
    },
    enabled: Boolean(operacionId),
  });
}

export function useSubirEvidenciaHito(operacionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      hitoId: string;
      file: File;
      anexoRequerido: EvidenciaDesembolsoHbi['anexoRequerido'];
      descripcion?: string;
    }) =>
      delay(
        MockHbiStore.subirEvidenciaHito(operacionId, input.hitoId, {
          nombreArchivo: input.file.name,
          anexoRequerido: input.anexoRequerido,
          descripcion: input.descripcion,
        })
      ),
    onSuccess: () => invalidateDesembolsos(qc, operacionId),
  });
}

export function useMarcarChecklistHito(operacionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { hitoId: string; itemIndex: number; cumplido: boolean }) =>
      delay(
        MockHbiStore.marcarChecklistHito(
          operacionId,
          input.hitoId,
          input.itemIndex,
          input.cumplido
        )
      ),
    onSuccess: () => invalidateDesembolsos(qc, operacionId),
  });
}

export function useActualizarHitoDesembolso(operacionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      hitoId: string;
      patch: Partial<
        Pick<
          HitoDesembolsoHbi,
          'nombre' | 'descripcionFase' | 'faseProyecto' | 'fechaObjetivo' | 'porcentaje'
        >
      >;
    }) => delay(MockHbiStore.actualizarHitoDesembolso(operacionId, input.hitoId, input.patch)),
    onSuccess: () => invalidateDesembolsos(qc, operacionId),
  });
}

export function useEjecutarDesembolso(operacionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (hitoId: string) => delay(MockHbiStore.ejecutarDesembolso(operacionId, hitoId)),
    onSuccess: () => invalidateDesembolsos(qc, operacionId),
  });
}
