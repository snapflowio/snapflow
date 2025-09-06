import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { WorkspaceMemberRole } from "../enums/workspace-member-role.enum";

@ApiSchema({ name: "UpdateWorkspaceMemberRole" })
export class UpdateWorkspaceMemberRoleDto {
  @ApiProperty({
    description: "Workspace member role",
    enum: WorkspaceMemberRole,
  })
  @IsEnum(WorkspaceMemberRole)
  role: WorkspaceMemberRole;
}
