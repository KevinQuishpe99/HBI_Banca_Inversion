'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { formInputPurple, formLabel } from '@/components/ui/form-classes';

type Props = {
  id?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
};

export function PasswordInputWithToggle({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete = 'new-password',
  minLength,
  required,
}: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className={formLabel}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${formInputPurple} pr-10`}
          placeholder={placeholder}
          autoComplete={autoComplete}
          minLength={minLength}
          required={required}
        />
        <button
          type="button"
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
