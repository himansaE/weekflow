import { HttpStatus } from '@nestjs/common';
import { ApiErrorCode } from '@weekflow/shared';
import type { ApiError } from '@weekflow/shared';
import type { Request, Response } from 'express';
import { REQUEST_ID_HEADER } from './request-id.middleware';

/**
 * Terminal 404 for paths no controller claimed.
 *
 * This is raw Express middleware sitting after the Nest router, so it must write
 * the §15.1 envelope itself: an error handed to `next()` here reaches Express's
 * default handler — which renders an HTML page and, in development, the stack
 * trace — never Nest's exception filter.
 */
export function notFoundHandler(req: Request, res: Response): void {
  const requestId = String(req.headers[REQUEST_ID_HEADER] ?? '');

  const body: ApiError = {
    error: {
      code: ApiErrorCode.NOT_FOUND,
      message: 'Not found.',
      requestId,
    },
  };

  res.status(HttpStatus.NOT_FOUND).json(body);
}
