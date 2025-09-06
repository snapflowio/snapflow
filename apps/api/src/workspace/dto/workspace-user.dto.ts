import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { User, WorkspaceUser } from "../../database/schema";
import { WorkspaceMemberRole } from "../enums/workspace-member-role.enum";

@ApiSchema({ name: "WorkspaceUser" })
export class WorkspaceUserDto {
  @ApiProperty({
    description: "User ID",
  })
  userId: string;

  @ApiProperty({
    description: "Workspace ID",
  })
  workspaceId: string;

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
    enum: WorkspaceMemberRole,
  })
  role: WorkspaceMemberRole;

  @ApiProperty({
    description: "Creation timestamp",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Last update timestamp",
  })
  updatedAt: Date;

  static fromEntities(
    workspaceUser: WorkspaceUser,
    user: User | null | undefined
  ): WorkspaceUserDto {
    return {
      ...workspaceUser,
      name: user ? user.name : "",
      email: user ? user.email : "",
    };
  }
}
