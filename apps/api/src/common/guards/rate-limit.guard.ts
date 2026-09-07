import { CanActivate, ExecutionContext, HttpStatus, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiErrorCode } from '@weekflow/shared';
import type { Request } from 'express';
import { ApiException } from '../errors/api.exception';

export const RATE_LIMIT_KEY = 'weekflow:rateLimit';

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window rate limiting for the authentication endpoints (§12.2).
 *
 * Hand-rolled rather than `@nestjs/throttler`, which supports NestJS 11 and
 * below only.
 *
 * Known limits, stated rather than implied: the counters live in this process, so
 * they reset on restart and are per-instance rather than per-cluster. That is
 * adequate for slowing credential stuffing against a single-instance deployment,
 * and is not a substitute for account lockout or a shared store.
 *
 * The client address comes from Express with `trust proxy` enabled, so behind the
 * Vercel rewrite it is the real client rather than one edge address.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private lastSweep = 0;

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const now = Date.now();
    this.sweep(now);

    // Scoped per route as well as per address, so exhausting the login budget
    // does not also lock the caller out of registering. The route pattern is
    // preferred over the raw path so parameterised routes share one bucket;
    // Express types it loosely, hence the explicit narrowing.
    const route: unknown = (request as { route?: unknown }).route;
    const routeKey =
      typeof route === 'object' &&
      route !== null &&
      typeof (route as { path?: unknown }).path === 'string'
        ? (route as { path: string }).path
        : request.path;
    const key = `${request.ip ?? 'unknown'}:${request.method}:${routeKey}`;
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return true;
    }

    bucket.count += 1;
    if (bucket.count > options.limit) {
      const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
      throw new ApiException(
        ApiErrorCode.RATE_LIMITED,
        HttpStatus.TOO_MANY_REQUESTS,
        `Too many attempts. Try again in ${retryAfterSeconds} seconds.`,
      );
    }

    return true;
  }

  /**
   * Clears every counter.
   *
   * Exists for the integration suite, which registers many accounts from one
   * address and would otherwise exhaust the budget partway through a run. The
   * guard is registered as a normal provider aliased by APP_GUARD, so tests
   * resolve this exact singleton rather than a second instance.
   */
  reset(): void {
    this.buckets.clear();
    this.lastSweep = 0;
  }

  /** Drops expired buckets so the map cannot grow without bound. */
  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;

    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}
