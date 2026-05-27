import { UserRole } from './user.types';
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    areaId?: number;
    /** Nombre visible del área (`configuracion_areas.nombre_area`). */
    areaName?: string;
    canSign?: boolean;
    /** True si es el supervisor de área registrado para su área (solo rol AREA_USER). */
    isAreaSupervisor?: boolean;
    /** Derivado de configuracion_areas.permite_firma para el área del usuario. */
    isSigningArea?: boolean;
    /** Derivado de configuracion_areas.es_paso_final para el área del usuario. */
    isFinalStepArea?: boolean;
    /** False solo si es supervisor titular del área y el área tiene deshabilitada la creación de trámites. */
    supervisorCanCreateCase?: boolean;
    /** Derivado de configuracion_areas.puede_completar_tramite. */
    puedeCompletarTramite?: boolean;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      areaId?: number;
      areaName?: string;
      canSign?: boolean;
      isAreaSupervisor?: boolean;
      isSigningArea?: boolean;
      isFinalStepArea?: boolean;
      supervisorCanCreateCase?: boolean;
      puedeCompletarTramite?: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
    areaId?: number;
    areaName?: string;
    email: string;
    canSign?: boolean;
    isAreaSupervisor?: boolean;
    isSigningArea?: boolean;
    isFinalStepArea?: boolean;
    supervisorCanCreateCase?: boolean;
    puedeCompletarTramite?: boolean;
  }
}
