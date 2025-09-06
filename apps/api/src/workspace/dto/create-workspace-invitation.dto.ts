import { ApiProperty, ApiPropertyOptional, ApiSchema } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDate, IsEmail, IsEnum, IsOptional, IsString } from "class-validator";
import { WorkspaceMemberRole } from "../enums/workspace-member-role.enum";

@ApiSchema({ name: "CreateWorkspaceInvitation" })
export class CreateWorkspaceInvitationDto {
  @ApiProperty({
    description: "Email address of the inviting user",
    example: "test@mail.com",
    required: true,
  })
  @IsString()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: "Workspace role of the inviting user",
    enum: WorkspaceMemberRole,
    default: WorkspaceMemberRole.MEMBER,
  })
  @IsEnum(WorkspaceMemberRole)
  role: WorkspaceMemberRole;

  @ApiPropertyOptional({
    description: "Expiration date of the invitation",
    example: "2025-07-03T23:59:59Z",
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;
}
