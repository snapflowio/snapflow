import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { User } from "../../user/user.entity";
import { OrganizationUser } from "../entities/organization-user.entity";
import { OrganizationMemberRole } from "../enums/organization-member-role.enum";
import { OrganizationRoleDto } from "./organization-role.dto";

@ApiSchema({ name: "OrganizationUser" })
export class OrganizationUserDto {
  @ApiProperty({
    description: "User ID",
  })
  userId: string;

  @ApiProperty({
    description: "Organization ID",
  })
  organizationId: string;

  @ApiProperty({
    description: "User name",
  })
  name: string;

  @ApiProperty({
    description: "User email",
  })
  email: string;

  @ApiProperty({
    description: "Member role",
    enum: OrganizationMemberRole,
  })
  role: OrganizationMemberRole;

  @ApiProperty({
    description: "Roles assigned to the user",
    type: [OrganizationRoleDto],
  })
  assignedRoles: OrganizationRoleDto[];

  @ApiProperty({
    description: "Creation timestamp",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Last update timestamp",
  })
  updatedAt: Date;

  static fromEntities(
    organizationUser: OrganizationUser,
    user: User | null | undefined,
  ): OrganizationUserDto {
    return {
      ...organizationUser,
      assignedRoles: organizationUser.assignedRoles.map(
        OrganizationRoleDto.fromOrganizationRole,
      ),
      name: user ? user.name : "",
      email: user ? user.email : "",
    };
  }
}
