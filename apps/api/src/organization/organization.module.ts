import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { UserModule } from "../user/user.module";
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
    ]),
  ],
  controllers: [],
  providers: [
    OrganizationService,
    OrganizationRoleService,
    OrganizationUserService,
    OrganizationInvitationService,
  ],
  exports: [
    OrganizationService,
    OrganizationRoleService,
    OrganizationUserService,
    OrganizationInvitationService,
  ],
})
export class OrganizationModule {}
