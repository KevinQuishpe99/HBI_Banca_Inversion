import { redirect } from 'next/navigation';

/** La sección «General» se eliminó; la entrada de administración es usuarios. */
export default function AdminIndexPage() {
  redirect('/admin/users');
}
