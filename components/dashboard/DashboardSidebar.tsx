'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usaDatosQuemadosHbi } from '@/lib/hbi/mock-config';
import {
  Home,
  FolderOpen,
  CheckSquare,
  PlusCircle,
  Search,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Users,
  Workflow,
  Tags,
  GitBranch,
  FilePlus,
  Trash2,
  Mail,
  Landmark,
  Layers,
} from 'lucide-react';

type Props = {
  pathname: string;
  isAdmin: boolean;
  isAreaUser: boolean;
  canReview: boolean;
  /** False solo para supervisor titular cuando el área deshabilita crear trámites. */
  canCreateCase: boolean;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  adminExpanded: boolean;
  onCloseMobile: () => void;
  onToggleCollapse: () => void;
  onToggleAdmin: () => void;
};

export function DashboardSidebar({
  pathname,
  isAdmin,
  isAreaUser,
  canReview,
  canCreateCase,
  sidebarOpen,
  sidebarCollapsed,
  adminExpanded,
  onCloseMobile,
  onToggleCollapse,
  onToggleAdmin,
}: Props) {
  const labelHidden = sidebarCollapsed ? 'lg:hidden' : '';
  const soloHbi = usaDatosQuemadosHbi();

  const navItemClass = (active: boolean) =>
    [
      'group flex items-center gap-3 rounded-xl transition-all duration-200',
      sidebarCollapsed ? 'lg:justify-center lg:px-2' : 'px-3 py-2.5',
      active
        ? 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-900 shadow-sm ring-1 ring-blue-200/70'
        : 'text-slate-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50/80 hover:text-blue-900',
    ].join(' ');

  const isPathActive = (href: string) => {
    if (href === '/') return pathname === '/' || pathname === '';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-30 bg-white/30 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
          aria-hidden
        />
      ) : null}

      <aside
        className={[
          'fixed bottom-0 left-0 top-16 z-40 overflow-x-hidden border-r border-blue-100/90 bg-gradient-to-b from-slate-50 via-white to-blue-50/50 shadow-md shadow-blue-900/5',
          'transform transition-all duration-300 ease-in-out',
          sidebarCollapsed ? 'w-16 max-w-[4rem]' : 'w-64 max-w-[16rem]',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        ].join(' ')}
      >
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <div className="hidden justify-end border-b border-blue-100/80 bg-gradient-to-r from-blue-50/90 to-indigo-50/50 p-2 lg:flex">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="rounded-lg p-2 text-blue-700 transition-colors hover:bg-white/80 hover:text-blue-900"
              title={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
            >
              {sidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </button>
          </div>

          <nav className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3 sm:p-4">
            <Link
              href="/"
              onClick={onCloseMobile}
              className={navItemClass(isPathActive('/'))}
              title="Inicio HBI"
            >
              <Home className="h-5 w-5 flex-shrink-0 text-blue-600 group-hover:text-blue-700" />
              <span className={`${labelHidden} font-medium transition-opacity`}>Inicio</span>
            </Link>
            <Link
              href="/operaciones"
              onClick={onCloseMobile}
              className={navItemClass(isPathActive('/operaciones'))}
              title="Operaciones de crédito"
            >
              <Landmark className="h-5 w-5 flex-shrink-0 text-blue-700 group-hover:text-blue-800" />
              <span className={`${labelHidden} font-medium transition-opacity`}>
                Operaciones HBI
              </span>
            </Link>
            <Link
              href="/operaciones/nueva"
              onClick={onCloseMobile}
              className={navItemClass(isPathActive('/operaciones/nueva'))}
              title="Nueva operación"
            >
              <Layers className="h-5 w-5 flex-shrink-0 text-indigo-600 group-hover:text-indigo-700" />
              <span className={`${labelHidden} font-medium transition-opacity`}>
                Nueva operación
              </span>
            </Link>

            {!soloHbi && !isAdmin && !isAreaUser ? (
              <>
                <Link
                  href="/cases"
                  onClick={onCloseMobile}
                  className={navItemClass(isPathActive('/cases'))}
                  title="Trámites (legado)"
                >
                  <FolderOpen className="h-5 w-5 flex-shrink-0 text-slate-500 group-hover:text-slate-700" />
                  <span className={`${labelHidden} font-medium transition-opacity text-slate-600`}>
                    Trámites (legado)
                  </span>
                </Link>
              </>
            ) : null}

            {!soloHbi && canReview && !isAdmin ? (
              <>
                <Link
                  href="/review"
                  onClick={onCloseMobile}
                  className={navItemClass(isPathActive('/review'))}
                  title="Revisar"
                >
                  <CheckSquare className="h-5 w-5 flex-shrink-0 text-emerald-600 group-hover:text-emerald-700" />
                  <span className={`${labelHidden} font-medium transition-opacity`}>Revisar</span>
                </Link>
                <Link
                  href="/tracking"
                  onClick={onCloseMobile}
                  className={navItemClass(isPathActive('/tracking'))}
                  title="Trámites"
                >
                  <Search className="h-5 w-5 flex-shrink-0 text-violet-600 group-hover:text-violet-700" />
                  <span className={`${labelHidden} font-medium transition-opacity`}>Trámites</span>
                </Link>
                {canCreateCase ? (
                  <Link
                    href="/cases/new"
                    onClick={onCloseMobile}
                    className={navItemClass(isPathActive('/cases/new'))}
                    title="Nuevo trámite"
                  >
                    <PlusCircle className="h-5 w-5 flex-shrink-0 text-blue-600 group-hover:text-blue-700" />
                    <span className={`${labelHidden} font-medium transition-opacity`}>Nuevo trámite</span>
                  </Link>
                ) : null}
              </>
            ) : null}

            {!soloHbi && isAdmin ? (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={onToggleAdmin}
                  className={[
                    'group flex w-full items-center gap-3 rounded-xl text-slate-700 transition-all duration-200',
                    sidebarCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between px-3 py-2.5',
                    'hover:bg-gradient-to-r hover:from-slate-100 hover:to-blue-50/80 hover:text-blue-900',
                  ].join(' ')}
                  title="Administración"
                >
                  <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'lg:justify-center' : ''}`}>
                    <Settings className="h-5 w-5 flex-shrink-0 text-slate-600 group-hover:text-blue-700" />
                    <span className={`font-medium ${labelHidden} transition-opacity`}>Administración</span>
                  </div>
                  {!sidebarCollapsed ? (
                    <span className="hidden lg:block">
                      {adminExpanded ? (
                        <ChevronUp className="h-4 w-4 text-blue-600" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-blue-600" />
                      )}
                    </span>
                  ) : null}
                </button>

                {adminExpanded && !sidebarCollapsed ? (
                  <div className="ml-2 min-w-0 space-y-1 border-l-2 border-blue-200/90 pl-3 pr-1">
                    <AdminSubLink
                      href="/admin/users"
                      pathname={pathname}
                      onNavigate={onCloseMobile}
                      icon={<Users className="h-4 w-4 flex-shrink-0 text-indigo-600" />}
                    >
                      Gestión de Usuarios
                    </AdminSubLink>
                    <AdminSubLink
                      href="/admin/areas"
                      pathname={pathname}
                      onNavigate={onCloseMobile}
                      icon={<Workflow className="h-4 w-4 flex-shrink-0 text-violet-600" />}
                    >
                      Configuración de Áreas
                    </AdminSubLink>
                    <AdminSubLink
                      href="/admin/statuses"
                      pathname={pathname}
                      onNavigate={onCloseMobile}
                      icon={<Tags className="h-4 w-4 flex-shrink-0 text-teal-600" />}
                    >
                      Estados y etiquetas
                    </AdminSubLink>
                    <AdminSubLink
                      href="/admin/workflows"
                      pathname={pathname}
                      onNavigate={onCloseMobile}
                      icon={<GitBranch className="h-4 w-4 flex-shrink-0 text-blue-600" />}
                    >
                      Flujos y enrutado
                    </AdminSubLink>
                    <AdminSubLink
                      href="/admin/correos"
                      pathname={pathname}
                      onNavigate={onCloseMobile}
                      icon={<Mail className="h-4 w-4 flex-shrink-0 text-amber-600" />}
                    >
                      Correos enviados
                    </AdminSubLink>
                    <AdminSubLink
                      href="/admin/supervisor-crear-tramites"
                      pathname={pathname}
                      onNavigate={onCloseMobile}
                      icon={<FilePlus className="h-4 w-4 flex-shrink-0 text-sky-600" />}
                    >
                      Decisión de nuevos trámites
                    </AdminSubLink>
                    <AdminSubLink
                      href="/admin/limpiar-tramites"
                      pathname={pathname}
                      onNavigate={onCloseMobile}
                      icon={<Trash2 className="h-4 w-4 flex-shrink-0 text-red-600" />}
                    >
                      Eliminar trámites
                    </AdminSubLink>
                  </div>
                ) : null}
              </div>
            ) : null}
          </nav>
        </div>
      </aside>
    </>
  );
}

function AdminSubLink({
  href,
  pathname,
  onNavigate,
  icon,
  children,
}: {
  href: string;
  pathname: string;
  onNavigate: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
        active
          ? 'bg-gradient-to-r from-blue-100 to-indigo-100 font-medium text-blue-900 ring-1 ring-blue-200/60'
          : 'text-slate-600 hover:bg-blue-50/80 hover:text-blue-900'
      }`}
    >
      {icon}
      <span className="min-w-0 break-words leading-snug">{children}</span>
    </Link>
  );
}
