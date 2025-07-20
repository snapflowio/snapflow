import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RedisLockProvider } from "../sandbox/common/redis-lock.provider";
import { Bucket } from "../sandbox/entities/bucket.entity";
import { Image } from "../sandbox/entities/image.entity";
import { ImageExecutor } from "../sandbox/entities/image-executor.entity";
import { Sandbox } from "../sandbox/entities/sandbox.entity";
import { UserModule } from "../user/user.module";
import { OrganizationController } from "./controllers/organization.controller";
import { OrganizationInvitationController } from "./controllers/organization-invitation.controller";
import { OrganizationRoleController } from "./controllers/organization-role.controller";
import { OrganizationUserController } from "./controllers/organization-user.controller";
import { Organization } from "./entities/organization.entity";
import { OrganizationInvitation } from "./entities/organization-invitation.entity";
import { OrganizationRole } from "./entities/organization-role.entity";
import { OrganizationUser } from "./entities/organization-user.entity";
import { OrganizationService } from "./services/organization.service";
import { OrganizationInvitationService } from "./services/organization-invitation.service";
import { OrganizationRoleService } from "./services/organization-role.service";
import { OrganizationUserService } from "./services/organization-user.service";

@Module({
  imports: [
    UserModule,
    TypeOrmModule.forFeature([
      Organization,
      OrganizationRole,
      OrganizationUser,
      OrganizationInvitation,
      Sandbox,
      Image,
      Bucket,
      ImageExecutor,
    ]),
  ],
  controllers: [
    OrganizationController,
    OrganizationRoleController,
    OrganizationUserController,
    OrganizationInvitationController,
  ],
  providers: [
    OrganizationService,
    OrganizationRoleService,
    OrganizationUserService,
    OrganizationInvitationService,
    RedisLockProvider,
  ],
  exports: [
    OrganizationService,
    OrganizationRoleService,
    OrganizationUserService,
    OrganizationInvitationService,
  ],
})
export class OrganizationModule {}
