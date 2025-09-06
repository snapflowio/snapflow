import { ApiProperty, ApiPropertyOptional, ApiSchema } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDate, IsEnum, IsOptional } from "class-validator";
import { WorkspaceMemberRole } from "../enums/workspace-member-role.enum";

@ApiSchema({ name: "UpdateWorkspaceInvitation" })
export class UpdateWorkspaceInvitationDto {
  @ApiProperty({
    description: "Workspace member role",
    enum: WorkspaceMemberRole,
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
