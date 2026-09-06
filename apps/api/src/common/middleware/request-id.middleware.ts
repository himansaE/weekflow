import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Correlates the client-visible `requestId` (§15.1) with the server log line for
 * the same request.
 *
 * Registered directly on the Express instance rather than through
 * `MiddlewareConsumer`, because consumer routes are scoped under the global
 * prefix — health checks and unmatched paths would otherwise get no id, which is
 * exactly when a correlation id is most useful.
 *
 * An inbound id is honoured only if it looks like an id; otherwise a caller could
 * inject arbitrary text into logs and response bodies.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const inbound = req.headers[REQUEST_ID_HEADER];
  const candidate = Array.isArray(inbound) ? inbound[0] : inbound;
  const requestId =
    candidate && /^[A-Za-z0-9._-]{8,64}$/.test(candidate)
      ? candidate
      : randomUUID();

  req.headers[REQUEST_ID_HEADER] = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}
