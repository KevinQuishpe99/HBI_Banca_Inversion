import { ComwareLogo } from '@/components/brand/ComwareLogo';
import { UI_COPY } from '@/lib/ui-copy';

export function LoginHeader() {
  return (
    <div className="space-y-5 text-center">
      <ComwareLogo variant="login" />
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          {UI_COPY.appName}
        </h1>
      </div>
    </div>
  );
}
