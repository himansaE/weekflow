import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'weekflow:isPublic';

/**
 * Opts a route out of the globally registered `JwtAuthGuard`.
 *
 * The guard is global so the default is deny: a new controller is protected
 * because nobody remembered to protect it, and forgetting this decorator fails
 * closed (a route returns 401) rather than open (§3.2).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
