export interface AdminUserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  role: string;
  area?: string;
  /** Firma operativa: `puede_firmar` en BD y área configurada para firma (Legal o cierre DG). */
  canSign?: boolean;
  /** Valor almacenado en `usuarios.puede_firmar` (checkbox en edición). */
  puedeFirmar?: boolean;
  /** Si el área asignada admite usuarios con permiso de firma (según banderas del área). */
  areaSupportsSigning?: boolean;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}
