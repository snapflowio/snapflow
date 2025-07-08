import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { OrganizationMemberRole } from "../enums/organization-member-role.enum";

@ApiSchema({ name: "UpdateOrganizationMemberRole" })
export class UpdateOrganizationMemberRoleDto {
  @ApiProperty({
    description: "Organization member role",
    enum: OrganizationMemberRole,
  })
  @IsEnum(OrganizationMemberRole)
  role: OrganizationMemberRole;
}
