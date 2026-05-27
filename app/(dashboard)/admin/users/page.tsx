import { UserManagement } from '@/components/admin/UserManagement';
import { adminPageTitle } from '@/lib/ui/admin-ui';

export default function AdminUsersPage() {
  return (
    <div className="min-w-0 space-y-6">
      <header className="min-w-0">
        <h1 className={`${adminPageTitle} break-words`}>Gestión de usuarios</h1>
      </header>
      <UserManagement />
    </div>
  );
}
