'use client';

import { AdminWipeTramitesPanel } from '@/components/admin/AdminWipeTramitesPanel';

export default function AdminLimpiarTramitesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-admin-text">Eliminar trámites</h1>
        <p className="mt-1 text-sm text-admin-text-secondary">
          Herramienta de desarrollo: borrado definitivo de expedientes. Misma disposición que el resto de administración.
        </p>
      </div>
      <AdminWipeTramitesPanel />
    </div>
  );
}
