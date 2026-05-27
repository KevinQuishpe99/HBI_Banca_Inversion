import { AdminCorreosPanel } from '@/components/admin/AdminCorreosPanel';
import { adminPageTitle } from '@/lib/ui/admin-ui';

export default function AdminCorreosPage() {
  return (
    <div className="min-w-0 space-y-6">
      <header className="min-w-0">
        <h1 className={`${adminPageTitle} break-words`}>Correos y notificaciones</h1>
      </header>
      <AdminCorreosPanel />
    </div>
  );
}
