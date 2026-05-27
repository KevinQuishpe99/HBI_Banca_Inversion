'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { esModoDemo } from '@/lib/demo/app-mode';
import { MockHbiStore } from '@/lib/hbi/mock-store';
import type {
  CarteraKpis,
  CovenantFinanciero,
  EstadoCovenant,
  ItemComiteCredito,
  ObligacionContractual,
  ReporteSindicato,
} from '@/types/hbi/ib-avanzado.types';

const MOCK = esModoDemo();

function delay<T>(data: T, ms = 260): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

export function useHbiCarteraKpis() {
  return useQuery({
    queryKey: ['hbi-cartera-kpis', MOCK],
    queryFn: () => (MOCK ? delay(MockHbiStore.carteraKpis()) : Promise.reject(new Error('Solo demo'))),
  });
}

export function useHbiCovenants(operacionId: string | undefined) {
  return useQuery({
    queryKey: ['hbi-covenants', operacionId, MOCK],
    queryFn: () => {
      if (!operacionId) return [];
      return MOCK ? delay(MockHbiStore.covenants(operacionId)) : Promise.reject(new Error('Solo demo'));
    },
    enabled: Boolean(operacionId),
  });
}

export function useHbiObligaciones(operacionId: string | undefined) {
  return useQuery({
    queryKey: ['hbi-obligaciones', operacionId, MOCK],
    queryFn: () => {
      if (!operacionId) return [];
      return MOCK ? delay(MockHbiStore.obligaciones(operacionId)) : Promise.reject(new Error('Solo demo'));
    },
    enabled: Boolean(operacionId),
  });
}

export function useHbiComite(operacionId: string | undefined) {
  return useQuery({
    queryKey: ['hbi-comite', operacionId, MOCK],
    queryFn: () => {
      if (!operacionId) return [];
      return MOCK ? delay(MockHbiStore.comite(operacionId)) : Promise.reject(new Error('Solo demo'));
    },
    enabled: Boolean(operacionId),
  });
}

function invalidateIb(queryClient: ReturnType<typeof useQueryClient>, operacionId: string) {
  void queryClient.invalidateQueries({ queryKey: ['hbi-covenants', operacionId] });
  void queryClient.invalidateQueries({ queryKey: ['hbi-obligaciones', operacionId] });
  void queryClient.invalidateQueries({ queryKey: ['hbi-comite', operacionId] });
  void queryClient.invalidateQueries({ queryKey: ['hbi-cartera-kpis'] });
  void queryClient.invalidateQueries({ queryKey: ['hbi-operacion-360', operacionId] });
  void queryClient.invalidateQueries({ queryKey: ['hbi-operaciones'] });
}

export function useActualizarCovenant(operacionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { covenantId: string; estado: EstadoCovenant }) =>
      delay(MockHbiStore.actualizarCovenant(input.covenantId, input.estado)),
    onSuccess: () => invalidateIb(qc, operacionId),
  });
}

export function useMarcarObligacion(operacionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (obligacionId: string) => delay(MockHbiStore.marcarObligacionCumplida(obligacionId)),
    onSuccess: () => invalidateIb(qc, operacionId),
  });
}

export function useVotarComite(operacionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { comiteId: string; voto: 'APROBAR' | 'RECHAZAR' | 'APROBAR_SESION' }) =>
      delay(MockHbiStore.votarComite(input.comiteId, input.voto)),
    onSuccess: () => invalidateIb(qc, operacionId),
  });
}

export function useGenerarReporteSindicato(operacionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => delay(MockHbiStore.generarReporteSindicato(operacionId)),
    onSuccess: () => invalidateIb(qc, operacionId),
  });
}

export function useEnviarReporteSindicato(operacionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reporte: ReporteSindicato) => delay(MockHbiStore.enviarReporteSindicato(reporte)),
    onSuccess: () => invalidateIb(qc, operacionId),
  });
}

export type { CovenantFinanciero, ObligacionContractual, ItemComiteCredito, CarteraKpis, ReporteSindicato };
