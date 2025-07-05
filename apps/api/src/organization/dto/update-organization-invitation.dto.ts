import { ApiProperty, ApiPropertyOptional, ApiSchema } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDate, IsEnum, IsOptional, IsString } from "class-validator";
import { OrganizationMemberRole } from "../enums/organization-member-role.enum";

@ApiSchema({ name: "UpdateOrganizationInvitation" })
export class UpdateOrganizationInvitationDto {
  @ApiProperty({
    description: "Organization member role",
    enum: OrganizationMemberRole,
  })
  @IsEnum(OrganizationMemberRole)
  role: OrganizationMemberRole;

  @ApiProperty({
    description: "Array of role IDs",
    type: [String],
  })
  @IsString({ each: true })
  assignedRoleIds: string[];

  @ApiPropertyOptional({
    description: "Expiration date of the invitation",
    example: "2025-07-03T23:59:59Z",
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;
}
