'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { usePermissions } from '@/hooks/useAuth';
import { MockSessionBridge } from '@/components/hbi/MockSessionBridge';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [adminExpanded, setAdminExpanded] = useState(true);
  const { data: session } = useSession();
  const pathname = usePathname();
  const { canCreateCase } = usePermissions();

  const userRole = session?.user?.role ?? 'USER';
  const isAdmin = userRole === 'ADMIN';
  const isAreaUser = userRole === 'AREA_USER';
  const canReview = userRole === 'ADMIN' || userRole === 'AREA_USER';

  return (
    <div className="min-h-screen bg-gray-50">
      <MockSessionBridge />
      <DashboardHeader
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
      />

      <div className="flex min-w-0 pt-16">
        <DashboardSidebar
          pathname={pathname}
          isAdmin={isAdmin}
          isAreaUser={isAreaUser}
          canReview={canReview}
          canCreateCase={canCreateCase()}
          sidebarOpen={sidebarOpen}
          sidebarCollapsed={sidebarCollapsed}
          adminExpanded={adminExpanded}
          onCloseMobile={() => setSidebarOpen(false)}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          onToggleAdmin={() => setAdminExpanded((e) => !e)}
        />

        <main
          className={[
            'box-border w-full min-w-0 flex-1 p-4 transition-[padding] duration-300 ease-in-out sm:p-6 lg:p-8',
            sidebarCollapsed
              ? 'lg:pl-[calc(4rem+1.25rem)]'
              : 'lg:pl-[calc(16rem+1.5rem)]',
          ].join(' ')}
        >
          <div className="mx-auto w-full min-w-0 max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
