import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AUTH_RATE_LIMITS } from '@weekflow/shared';
import type { SafeUser } from '@weekflow/shared';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RateLimit } from '../common/guards/rate-limit.guard';
import { ApiException } from '../common/errors/api.exception';
import type { Env } from '../config/env.schema';
import { clearSessionCookie, setSessionCookie } from './auth-cookie';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Public signup. Always creates a Team Member (§3.3).
   *
   * No session is issued: registration returns the account and the user signs in,
   * which keeps "who is signed in" a decision of the login endpoint alone.
   */
  @Public()
  @RateLimit(AUTH_RATE_LIMITS.register)
  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<SafeUser> {
    if (dto.password !== dto.passwordConfirmation) {
      throw ApiException.validationFailed('Check the highlighted fields.', [
        { path: 'passwordConfirmation', message: 'Passwords do not match' },
      ]);
    }

    return this.auth.register({
      fullName: dto.fullName,
      email: dto.email,
      password: dto.password,
    });
  }

  /** Sets the session cookie. The token is never returned in the body (§12.2). */
  @Public()
  @RateLimit(AUTH_RATE_LIMITS.login)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<SafeUser> {
    const session = await this.auth.login(dto);
    setSessionCookie(res, this.config, session.token, session.expiresAt);
    return session.user;
  }

  /**
   * Idempotent: clearing an absent cookie is still a success, so a stale tab
   * signing out twice does not produce an error.
   *
   * Public because a user whose token already expired must still be able to clear
   * the browser's copy.
   */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) res: Response): void {
    clearSessionCookie(res, this.config);
  }

  /**
   * The identity the client renders the shell from. It reflects the *current*
   * database row, because the guard re-read it for this request — so a role
   * change or a deactivation shows up on the next call, not the next login.
   */
  @Get('me')
  me(@CurrentUser() user: SafeUser): SafeUser {
    return user;
  }
}
