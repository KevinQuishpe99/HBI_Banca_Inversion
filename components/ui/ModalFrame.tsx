'use client';

import type { ReactNode } from 'react';
import clsx from 'clsx';

type Props = {
  children: ReactNode;
  className?: string;
};

export function ModalFrame({ children, className }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/30 p-4 backdrop-blur-sm">
      <div
        className={clsx(
          'max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 shadow-2xl sm:p-6',
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
