import { ApiProperty, ApiPropertyOptional, ApiSchema } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsDate,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
} from "class-validator";
import { GlobalOrganizationRolesIds } from "../constants/global-organization-roles.constant";
import { OrganizationMemberRole } from "../enums/organization-member-role.enum";

@ApiSchema({ name: "CreateOrganizationInvitation" })
export class CreateOrganizationInvitationDto {
  @ApiProperty({
    description: "Email address of the inviting user",
    example: "test@mail.com",
    required: true,
  })
  @IsString()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: "Organization role of the inviting user",
    enum: OrganizationMemberRole,
    default: OrganizationMemberRole.MEMBER as string,
  })
  @IsEnum(OrganizationMemberRole)
  role: OrganizationMemberRole;

  @ApiProperty({
    description: "Role IDs of the inviting user",
    type: String,
    default: [GlobalOrganizationRolesIds.DEVELOPER as string],
  })
  @IsArray()
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
