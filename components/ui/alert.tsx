'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const alertVariants = cva('relative w-full rounded-lg border p-4 text-sm', {
  variants: {
    variant: {
      default: 'border-gray-200 bg-white text-gray-900',
      destructive: 'border-red-200 bg-red-50 text-red-900',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export function Alert({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn('text-sm text-current/90', className)} {...props} />;
}

