import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { WorkspaceInvitation } from "../../database/schema";
import { WorkspaceInvitationStatus } from "../enums/workspace-invitation-status.enum";
import { WorkspaceMemberRole } from "../enums/workspace-member-role.enum";

@ApiSchema({ name: "WorkspaceInvitation" })
export class WorkspaceInvitationDto {
  @ApiProperty({
    description: "Invitation ID",
  })
  id: string;

  @ApiProperty({
    description: "Email address of the user being invited",
  })
  email: string;

  @ApiProperty({
    description: "Email address of the inviter",
  })
  invitedBy: string;

  @ApiProperty({
    description: "Workspace ID",
  })
  workspaceId: string;

  @ApiProperty({
    description: "Workspace name",
  })
  workspaceName: string;

  @ApiProperty({
    description: "Expiration date of the invitation",
  })
  expiresAt: Date;

  @ApiProperty({
    description: "Invitation status",
    enum: WorkspaceInvitationStatus,
  })
  status: WorkspaceInvitationStatus;

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

  static fromWorkspaceInvitation(
    invitation: WorkspaceInvitation, 
    workspaceName: string
  ): WorkspaceInvitationDto {
    const dto: WorkspaceInvitationDto = {
      id: invitation.id,
      email: invitation.email,
      invitedBy: invitation.invitedBy,
      workspaceId: invitation.workspaceId,
      workspaceName: workspaceName,
      expiresAt: invitation.expiresAt,
      status: invitation.status,
      role: invitation.role,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
    };

    return dto;
  }
}
