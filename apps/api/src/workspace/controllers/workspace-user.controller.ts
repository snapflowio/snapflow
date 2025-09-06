import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Session } from "../../auth/decorators/session.decorator";
import { AuthGuard, UserSession } from "../../auth/guards/auth.guard";
import { RequiredWorkspaceMemberRole } from "../decorators/required-workspace-member-role.decorator";
import { UpdateWorkspaceMemberRoleDto } from "../dto/update-organization-member-role.dto";
import { WorkspaceUserDto } from "../dto/workspace-user.dto";
import { WorkspaceMemberRole } from "../enums/workspace-member-role.enum";
import { WorkspaceActionGuard } from "../guards/workspace-action.guard";
import { WorkspaceUserService } from "../services/workspace-user.service";

@ApiTags("workspaces")
@Controller("workspaces/:workspaceId/users")
@UseGuards(AuthGuard, WorkspaceActionGuard)
@ApiCookieAuth()
export class WorkspaceUserController {
  constructor(private readonly workspaceUserService: WorkspaceUserService) {}

  @Get()
  @ApiOperation({
    summary: "List workspace members",
    operationId: "listWorkspaceMembers",
  })
  @ApiResponse({
    status: 200,
    description: "List of workspace members",
    type: [WorkspaceUserDto],
  })
  @ApiParam({
    name: "workspaceId",
    description: "Workspace ID",
    type: "string",
  })
  async findAll(@Param("workspaceId") workspaceId: string): Promise<WorkspaceUserDto[]> {
    return this.workspaceUserService.findAll(workspaceId);
  }

  @Post("/:userId/role")
  @ApiOperation({
    summary: "Update role for workspace member",
    operationId: "updateRoleForWorkspaceMember",
  })
  @ApiResponse({
    status: 200,
    description: "Role updated successfully",
    type: WorkspaceUserDto,
  })
  @ApiParam({
    name: "workspaceId",
    description: "Workspace ID",
    type: "string",
  })
  @ApiParam({
    name: "userId",
    description: "User ID",
    type: "string",
  })
  @RequiredWorkspaceMemberRole(WorkspaceMemberRole.OWNER)
  async updateRole(
    @Session() session: UserSession,
    @Param("workspaceId") workspaceId: string,
    @Param("userId") userId: string,
    @Body() dto: UpdateWorkspaceMemberRoleDto
  ): Promise<WorkspaceUserDto> {
    if (session.user.id === userId) {
      throw new ForbiddenException("You cannot update your own role");
    }

    return this.workspaceUserService.updateRole(workspaceId, userId, dto.role);
  }

  @Delete("/:userId")
  @ApiOperation({
    summary: "Delete workspace member",
    operationId: "deleteWorkspaceMember",
  })
  @ApiResponse({
    status: 204,
    description: "User removed from workspace successfully",
  })
  @ApiParam({
    name: "workspaceId",
    description: "Workspace ID",
    type: "string",
  })
  @ApiParam({
    name: "userId",
    description: "User ID",
    type: "string",
  })
  @RequiredWorkspaceMemberRole(WorkspaceMemberRole.OWNER)
  async delete(
    @Param("workspaceId") workspaceId: string,
    @Param("userId") userId: string
  ): Promise<void> {
    return this.workspaceUserService.delete(workspaceId, userId);
  }
}