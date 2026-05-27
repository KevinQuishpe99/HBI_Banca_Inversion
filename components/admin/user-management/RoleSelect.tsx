'use client';

import { formInputPurple, formLabel } from '@/components/ui/form-classes';

type Props = {
  value: string;
  onChange: (role: string) => void;
  id?: string;
};

export function RoleSelect({ value, onChange, id }: Props) {
  return (
    <div>
      <label htmlFor={id} className={formLabel}>
        Rol
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={formInputPurple}
      >
        <option value="USER">Usuario (crea trámites)</option>
        <option value="AREA_USER">Supervisor de área (revisa y aprueba)</option>
        <option value="ADMIN">Administrador</option>
      </select>
    </div>
  );
}
