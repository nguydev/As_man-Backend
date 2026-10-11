import { Module } from '@nestjs/common';
import { AuthModule } from '@/core/auth/auth.module';
import { LocationModule } from '@/modules/location/location.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { AdminUsersController } from '@/modules/user/admin-users.controller';
import { UserService } from './user.service';
import { UserController } from './user.controller';

@Module({
  imports: [AuthModule, LocationModule, NotificationsModule],
  controllers: [UserController, AdminUsersController],
  providers: [UserService],
})
export class UserModule {}
