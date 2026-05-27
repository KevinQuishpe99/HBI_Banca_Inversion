import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { LoginForm } from '@/components/login/LoginForm';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-sky-50/90 to-indigo-100">
          <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
