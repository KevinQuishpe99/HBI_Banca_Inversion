export type UserRole = 
  | 'USER'       // Usuario normal (crea trámites)
  | 'AREA_USER' // Supervisor de área (revisa y aprueba trámites en su etapa)
  | 'ADMIN';     // Administrador

/** Identificador de área en API y permisos: id numérico de `configuracion_areas`. */
export type UserAreaId = number;

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  areaId?: number;
  /** Nombre visible del área (nombre_area). */
  areaName?: string;
  canSign?: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

export interface CreateUserDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  areaId?: number;
  canSign?: boolean;
}
