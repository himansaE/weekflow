import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiErrorCode } from '@weekflow/shared';
import type { ApiError, ApiFieldError } from '@weekflow/shared';
import type { Request, Response } from 'express';
import { ApiException } from '../errors/api.exception';
import { REQUEST_ID_HEADER } from '../middleware/request-id.middleware';

/**
 * Maps every thrown error onto the §15.1 error body.
 *
 * Nothing internal escapes: stack traces, SQL text and driver messages are logged
 * server-side and replaced by a sanitized message in the response.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = String(request.headers[REQUEST_ID_HEADER] ?? '');

    const { status, body } = this.describe(exception, requestId);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} → ${status} [${requestId}]`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.debug(
        `${request.method} ${request.url} → ${status} [${requestId}]`,
      );
    }

    response.status(status).json(body);
  }

  private describe(
    exception: unknown,
    requestId: string,
  ): { status: HttpStatus; body: ApiError } {
    if (exception instanceof ApiException) {
      return {
        status: exception.getStatus(),
        body: {
          error: {
            code: exception.code,
            message: exception.message,
            ...(exception.fieldErrors?.length
              ? { fieldErrors: exception.fieldErrors }
              : {}),
            requestId,
          },
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      return {
        status,
        body: {
          error: {
            code: this.codeForStatus(status),
            message: this.messageFrom(payload, exception.message),
            ...this.fieldErrorsFrom(payload),
            requestId,
          },
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Something went wrong. Try again.',
          requestId,
        },
      },
    };
  }

  private codeForStatus(status: HttpStatus): ApiErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ApiErrorCode.BAD_REQUEST;
      case HttpStatus.UNAUTHORIZED:
        return ApiErrorCode.UNAUTHENTICATED;
      case HttpStatus.FORBIDDEN:
        return ApiErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ApiErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ApiErrorCode.DUPLICATE_RESOURCE;
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return ApiErrorCode.VALIDATION_FAILED;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ApiErrorCode.RATE_LIMITED;
      default:
        return ApiErrorCode.INTERNAL_ERROR;
    }
  }

  /** class-validator hands back an array of constraint strings; the detail belongs
   * in fieldErrors, not in a wall of text on the top-level message. */
  private messageFrom(payload: unknown, fallback: string): string {
    if (typeof payload === 'string') return payload;

    const message = this.constraintPayload(payload);
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return 'Check the highlighted fields.';

    return fallback;
  }

  private fieldErrorsFrom(payload: unknown): { fieldErrors?: ApiFieldError[] } {
    const message = this.constraintPayload(payload);
    if (!Array.isArray(message)) return {};

    const fieldErrors = message
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => ({ path: entry.split(' ')[0] ?? '', message: entry }));

    return fieldErrors.length ? { fieldErrors } : {};
  }

  private constraintPayload(payload: unknown): unknown {
    if (payload && typeof payload === 'object' && 'message' in payload) {
      return payload.message;
    }
    return undefined;
  }
}
