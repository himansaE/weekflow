import { Global, Module } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * Global because JwtAuthGuard — which is itself global — depends on it to re-read
 * the actor on every authenticated request.
 */
@Global()
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
