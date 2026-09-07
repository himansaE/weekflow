import { HttpException, HttpStatus } from '@nestjs/common';
import { ApiErrorCode } from '@weekflow/shared';
import type { ApiFieldError } from '@weekflow/shared';

/**
 * The single error type the domain throws. Carrying the code explicitly keeps the
 * §15.1 status policy in one place instead of scattering bare HttpExceptions whose
 * status is chosen ad hoc at each throw site.
 */
export class ApiException extends HttpException {
  constructor(
    readonly code: ApiErrorCode,
    status: HttpStatus,
    message: string,
    readonly fieldErrors?: ApiFieldError[],
  ) {
    super({ code, message, fieldErrors }, status);
  }

  /** 400 — malformed shape, query or date. */
  static badRequest(message: string, fieldErrors?: ApiFieldError[]): ApiException {
    return new ApiException(ApiErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST, message, fieldErrors);
  }

  /** 422 — well-formed but fails report/business validation. */
  static validationFailed(message: string, fieldErrors?: ApiFieldError[]): ApiException {
    return new ApiException(
      ApiErrorCode.VALIDATION_FAILED,
      HttpStatus.UNPROCESSABLE_ENTITY,
      message,
      fieldErrors,
    );
  }

  static unauthenticated(message = 'Sign in to continue.'): ApiException {
    return new ApiException(ApiErrorCode.UNAUTHENTICATED, HttpStatus.UNAUTHORIZED, message);
  }

  static forbidden(message = 'You do not have access to this action.'): ApiException {
    return new ApiException(ApiErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN, message);
  }

  /**
   * 404 for both "absent" and "present but not visible to this actor" — the two
   * must be indistinguishable wherever existence would disclose another member's
   * data (§3.2).
   */
  static notFound(message = 'Not found.'): ApiException {
    return new ApiException(ApiErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, message);
  }

  static conflict(code: ApiErrorCode, message: string): ApiException {
    return new ApiException(code, HttpStatus.CONFLICT, message);
  }
}
