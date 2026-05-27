import { NextResponse } from 'next/server';
import { AppError } from './errors';
import { ZodError } from 'zod';
import {
  isAppErrorLike,
  mapUnknownErrorToAppError,
  zodErrorToUserMessage,
} from '@/lib/utils/map-operational-error';

export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}

const FALLBACK_USER_MESSAGE =
  'No se pudo completar la operación. Revise los datos e intente de nuevo. Si el problema continúa, contacte al administrador.';

export function errorResponse(error: unknown) {
  console.error('Error en API:', error);

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: zodErrorToUserMessage(error),
        details: error.errors,
      },
      { status: 400 }
    );
  }

  const mapped = mapUnknownErrorToAppError(error);
  const appErr =
    mapped ??
    (error instanceof AppError
      ? error
      : isAppErrorLike(error)
        ? error
        : null);

  if (appErr) {
    const body: Record<string, unknown> = {
      success: false,
      error: appErr.message,
    };
    const details = (appErr as AppError & { details?: Record<string, unknown> }).details;
    if (details && typeof details === 'object') {
      body.details = details;
    }
    return NextResponse.json(body, { status: appErr.statusCode });
  }

  const body: Record<string, unknown> = {
    success: false,
    error: FALLBACK_USER_MESSAGE,
  };
  if (process.env.NODE_ENV === 'development' && error instanceof Error) {
    body.details = { message: error.message, name: error.name };
  }
  return NextResponse.json(body, { status: 500 });
}
