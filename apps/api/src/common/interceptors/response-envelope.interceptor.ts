import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * Wraps every successful payload in the §15.1 envelope.
 *
 * A handler returns its payload directly. If it needs to attach a `context`
 * (an `asOf` instant, the selected week, the analytics source), it returns
 * `{ data, context }` already shaped and this interceptor passes it through
 * untouched. 204 responses are left alone — they carry no body.
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((payload: unknown) => {
        if (payload === undefined || payload === null) return payload;

        // Already enveloped by the handler (list results, or results with context).
        if (typeof payload === 'object' && payload !== null && 'data' in payload) {
          return payload;
        }

        return { data: payload };
      }),
    );
  }
}
