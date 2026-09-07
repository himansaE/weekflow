import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

/**
 * Global because the globally registered JwtAuthGuard needs TokenService on
 * every authenticated request.
 */
@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService],
  // PasswordService is exported because user administration also creates
  // accounts, and both paths must hash identically.
  exports: [TokenService, PasswordService],
})
export class AuthModule {}
