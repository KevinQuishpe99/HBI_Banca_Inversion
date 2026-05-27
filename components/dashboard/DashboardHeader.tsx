'use client';

import { Menu, X } from 'lucide-react';
import { ComwareLogo } from '@/components/brand/ComwareLogo';
import { UserMenu } from '@/components/shared/UserMenu';
import { NotificationBell } from '@/components/shared/NotificationBell';

type Props = {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
};

export function DashboardHeader({ sidebarOpen, onToggleSidebar }: Props) {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-[var(--color-brand-border)] bg-white shadow-sm">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onToggleSidebar}
              className="shrink-0 rounded-md p-2 text-[var(--color-brand-secondary)] hover:bg-[var(--color-brand-accent)] lg:hidden"
              aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
            >
              {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
            <div className="flex min-w-0 items-center gap-3">
              <ComwareLogo variant="header" />
              <h1 className="truncate text-lg font-bold text-[var(--color-brand-primary)] sm:text-xl">
                Plataforma HBI
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
