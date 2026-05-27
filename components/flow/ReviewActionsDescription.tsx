type Props = {
  /** Menos margen inferior cuando va pegado a otro bloque (p. ej. pestaña Archivos). */
  className?: string;
  /**
   * Dónde se muestra el aviso: el mensaje se adapta al rol y a la pestaña Archivos.
   * - `filesTab`: solo lo que hace «Guardar» en archivos frente a la barra de acciones.
   * - `supervision`: asignación del circuito de supervisión.
   * - `legal`: botones de Legal (completar / pasar a Director / devolver).
   * - `director`: finalizar o devolver.
   * - `area`: aprobar o devolver (paso intermedio).
   */
  context?: 'filesTab' | 'supervision' | 'legal' | 'director' | 'area';
};

const guardarSoloEnArchivos =
  '«Guardar» en esta pestaña solo aplica comentarios y copias firmadas pendientes (PDF o Word); no cambia el estado del trámite.';

const archivosVsAcciones =
  'En la pestaña Archivos, «Guardar» solo aplica comentarios y copias firmadas pendientes (PDF o Word).';

/**
 * Texto compartido: barra «Acciones de revisión», fase de supervisión y pestaña Archivos.
 */
export function ReviewActionsDescription({ className = 'mb-4 mt-1', context = 'area' }: Props) {
  if (context === 'filesTab') {
    return (
      <p className={`text-sm text-gray-700 ${className}`}>
        {guardarSoloEnArchivos} El avance del trámite (Aprobar, Devolver, Finalizar u otras opciones según su área) está
        en <span className="font-semibold text-gray-900">Acciones de revisión</span> arriba.
      </p>
    );
  }

  if (context === 'supervision') {
    return (
      <p className={`text-sm text-gray-700 ${className}`}>
        <span className="font-semibold text-gray-900">Aprobar</span> o{' '}
        <span className="font-semibold text-gray-900">Devolver</span> registran la asignación del circuito de revisión.{' '}
        {archivosVsAcciones}
      </p>
    );
  }

  if (context === 'legal') {
    return (
      <p className={`text-sm text-gray-700 ${className}`}>
        Use <span className="font-semibold text-gray-900">Trámite completado</span>,{' '}
        <span className="font-semibold text-gray-900">Pasar al Director General</span> o{' '}
        <span className="font-semibold text-gray-900">Devolver</span> según corresponda; {' '}
        {archivosVsAcciones}
      </p>
    );
  }

  if (context === 'director') {
    return (
      <p className={`text-sm text-gray-700 ${className}`}>
        <span className="font-semibold text-gray-900">Finalizar trámite</span> o{' '}
        <span className="font-semibold text-gray-900">Devolver</span> registran el cierre o la corrección.{' '}
        {archivosVsAcciones}
      </p>
    );
  }

  return (
    <p className={`text-sm text-gray-700 ${className}`}>
      <span className="font-semibold text-gray-900">Aprobar</span> o{' '}
      <span className="font-semibold text-gray-900">Devolver</span> registran su decisión en el flujo. {archivosVsAcciones}
    </p>
  );
}
