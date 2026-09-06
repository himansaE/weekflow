import { CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from '@weekflow/shared';
import type { ApiError } from '@weekflow/shared';
import axios, { AxiosError } from 'axios';

/**
 * The single HTTP client for authenticated application data.
 *
 * `withCredentials` carries the HttpOnly session cookie; the custom header is the
 * mandatory half of the CSRF baseline (§12.4) and is sent on every request so no
 * mutation can be issued as a simple cross-origin form post.
 *
 * In production `NEXT_PUBLIC_API_BASE_URL` is the relative `/api/v1`, which
 * Vercel rewrites to the Railway service — the browser stays same-origin.
 */
export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
  },
});

/** Narrowed view of the §15.1 error body. */
export interface ApiFailure {
  status: number;
  code: string;
  message: string;
  fieldErrors?: { path: string; message: string }[];
  requestId?: string;
}

export function toApiFailure(error: unknown): ApiFailure {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiError | undefined;
    if (body?.error) {
      return {
        status: error.response?.status ?? 0,
        code: body.error.code,
        message: body.error.message,
        fieldErrors: body.error.fieldErrors,
        requestId: body.error.requestId,
      };
    }
    return {
      status: error.response?.status ?? 0,
      code: 'NETWORK_ERROR',
      message: 'Could not reach the server. Check your connection and try again.',
    };
  }

  return { status: 0, code: 'UNKNOWN_ERROR', message: 'Something went wrong.' };
}

export function isUnauthenticated(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 401;
}
