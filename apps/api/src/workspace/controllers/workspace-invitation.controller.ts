import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Session } from "../../auth/decorators/session.decorator";
import { AuthGuard, UserSession } from "../../auth/guards/auth.guard";
import { RequiredWorkspaceMemberRole } from "../decorators/required-workspace-member-role.decorator";
import { CreateWorkspaceInvitationDto } from "../dto/create-workspace-invitation.dto";
import { UpdateWorkspaceInvitationDto } from "../dto/update-workspace-invitation.dto";
import { WorkspaceInvitationDto } from "../dto/workspace-invitation.dto";
import { WorkspaceMemberRole } from "../enums/workspace-member-role.enum";
import { WorkspaceActionGuard } from "../guards/workspace-action.guard";
import { WorkspaceInvitationService } from "../services/workspace-invitation.service";

@ApiTags("workspaces")
@Controller("workspaces/:workspaceId/invitations")
@UseGuards(AuthGuard, WorkspaceActionGuard)
@ApiCookieAuth()
export class WorkspaceInvitationController {
  constructor(private readonly workspaceInvitationService: WorkspaceInvitationService) {}

  @Post()
  @ApiOperation({
    summary: "Create workspace invitation",
    operationId: "createWorkspaceInvitation",
  })
  @ApiResponse({
    status: 201,
    description: "Workspace invitation created successfully",
    type: WorkspaceInvitationDto,
  })
  @ApiParam({
    name: "workspaceId",
    description: "Workspace ID",
    type: "string",
  })
  @RequiredWorkspaceMemberRole(WorkspaceMemberRole.OWNER)
  async create(
    @Session() session: UserSession,
    @Param("workspaceId") workspaceId: string,
    @Body() createWorkspaceInvitationDto: CreateWorkspaceInvitationDto
  ): Promise<WorkspaceInvitationDto> {
    const invitation = await this.workspaceInvitationService.create(
      workspaceId,
      createWorkspaceInvitationDto,
      session.user.id
    );

    const fullInvitation = await this.workspaceInvitationService.findOneOrFail(invitation.id);
    return WorkspaceInvitationDto.fromWorkspaceInvitation(
      invitation,
      fullInvitation.workspace.name
    );
  }

  @Put("/:invitationId")
  @ApiOperation({
    summary: "Update workspace invitation",
    operationId: "updateWorkspaceInvitation",
  })
  @ApiResponse({
    status: 200,
    description: "Workspace invitation updated successfully",
    type: WorkspaceInvitationDto,
  })
  @ApiParam({
    name: "workspaceId",
    description: "Workspace ID",
    type: "string",
  })
  @ApiParam({
    name: "invitationId",
    description: "Invitation ID",
    type: "string",
  })
  @RequiredWorkspaceMemberRole(WorkspaceMemberRole.OWNER)
  async update(
    @Param("invitationId") invitationId: string,
    @Body() updateWorkspaceInvitationDto: UpdateWorkspaceInvitationDto
  ): Promise<WorkspaceInvitationDto> {
    const invitation = await this.workspaceInvitationService.update(
      invitationId,
      updateWorkspaceInvitationDto
    );

    const fullInvitation = await this.workspaceInvitationService.findOneOrFail(invitation.id);
    return WorkspaceInvitationDto.fromWorkspaceInvitation(
      invitation,
      fullInvitation.workspace.name
    );
  }

  @Get()
  @ApiOperation({
    summary: "List pending workspace invitations",
    operationId: "listWorkspaceInvitations",
  })
  @ApiResponse({
    status: 200,
    description: "List of pending workspace invitations",
    type: [WorkspaceInvitationDto],
  })
  @ApiParam({
    name: "workspaceId",
    description: "Workspace ID",
    type: "string",
  })
  async findPending(@Param("workspaceId") workspaceId: string): Promise<WorkspaceInvitationDto[]> {
    const invitations = await this.workspaceInvitationService.findPending(workspaceId);
    return invitations.map((invitation) =>
      WorkspaceInvitationDto.fromWorkspaceInvitation(invitation, invitation.workspace.name)
    );
  }

  @Post("/:invitationId/cancel")
  @ApiOperation({
    summary: "Cancel workspace invitation",
    operationId: "cancelWorkspaceInvitation",
  })
  @ApiResponse({
    status: 204,
    description: "Workspace invitation cancelled successfully",
  })
  @ApiParam({
    name: "workspaceId",
    description: "Workspace ID",
    type: "string",
  })
  @ApiParam({
    name: "invitationId",
    description: "Invitation ID",
    type: "string",
  })
  @RequiredWorkspaceMemberRole(WorkspaceMemberRole.OWNER)
  async cancel(@Param("invitationId") invitationId: string): Promise<void> {
    return this.workspaceInvitationService.cancel(invitationId);
  }
}
