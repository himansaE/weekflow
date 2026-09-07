import { Global, Module } from '@nestjs/common';
import { UsersAdminService } from './users.admin.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * Global because JwtAuthGuard — which is itself global — depends on it to re-read
 * the actor on every authenticated request.
 */
@Global()
@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersAdminService],
  exports: [UsersService],
})
export class UsersModule {}
