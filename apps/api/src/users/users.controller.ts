import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Role } from '@weekflow/shared';
import type { AdminSafeUser, ApiList, SafeUser } from '@weekflow/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiException } from '../common/errors/api.exception';
import { UsersAdminService } from './users.admin.service';
import {
  ChangeRoleDto,
  CreateUserDto,
  ExpectedRevisionDto,
  UserListQueryDto,
} from './dto/users.dto';

/**
 * User administration (§15.3). Manager-only at the route level; the invariants
 * that depend on *which* manager (no self-demotion, never the last one) are
 * enforced in the service, where the transaction is.
 */
@Roles(Role.MANAGER)
@Controller('users')
export class UsersController {
  constructor(private readonly admin: UsersAdminService) {}

  @Get()
  list(@Query() query: UserListQueryDto): Promise<ApiList<AdminSafeUser>> {
    return this.admin.list(query);
  }

  @Post()
  create(@CurrentUser() actor: SafeUser, @Body() dto: CreateUserDto): Promise<AdminSafeUser> {
    if (dto.password !== dto.passwordConfirmation) {
      throw ApiException.validationFailed('Check the highlighted fields.', [
        { path: 'passwordConfirmation', message: 'Passwords do not match' },
      ]);
    }

    return this.admin.create(actor, {
      fullName: dto.fullName,
      email: dto.email,
      role: dto.role,
      password: dto.password,
    });
  }

  @Post(':id/role')
  changeRole(
    @CurrentUser() actor: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeRoleDto,
  ): Promise<AdminSafeUser> {
    return this.admin.changeRole(actor, id, dto.role, dto.expectedRevision);
  }

  @Post(':id/deactivate')
  deactivate(
    @CurrentUser() actor: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExpectedRevisionDto,
  ): Promise<AdminSafeUser> {
    return this.admin.setActive(actor, id, false, dto.expectedRevision);
  }

  @Post(':id/reactivate')
  reactivate(
    @CurrentUser() actor: SafeUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExpectedRevisionDto,
  ): Promise<AdminSafeUser> {
    return this.admin.setActive(actor, id, true, dto.expectedRevision);
  }
}
