import { Body, Controller, Delete, ForbiddenException, Get, Post, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Session } from "../../auth/decorators/session.decorator";
import { AuthGuard, UserSession } from "../../auth/guards/auth.guard";
import { Workspace } from "../../database/schema";
import { UserService } from "../../user/user.service";
import { RequiredWorkspaceMemberRole } from "../decorators/required-workspace-member-role.decorator";
import { CurrentWorkspace } from "../decorators/workspace-context.decorator";
import { CreateWorkspaceDto } from "../dto/create-workspace-module.dto";
import { WorkspaceDto } from "../dto/workspace.dto";
import { WorkspaceMemberRole } from "../enums/workspace-member-role.enum";
import { WorkspaceAccessGuard } from "../guards/workspace-access.guard";
import { WorkspaceActionGuard } from "../guards/workspace-action.guard";
import { WorkspaceService } from "../services/workspace.service";

@ApiTags("workspaces")
@Controller("workspaces")
@ApiCookieAuth()
@UseGuards(AuthGuard)
export class WorkspaceController {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly userService: UserService
  ) {}

  @Post()
  @ApiOperation({
    summary: "Create a workspace",
    operationId: "createWorkspace",
  })
  @ApiResponse({
    status: 201,
    description: "Workspace created successfully",
    type: WorkspaceDto,
  })
  async create(
    @Session() session: UserSession,
    @Body() createWorkspaceDto: CreateWorkspaceDto
  ): Promise<WorkspaceDto> {
    const user = await this.userService.findOne(session.user.id);
    if (!user.emailVerified) {
      throw new ForbiddenException("Please verify your email address");
    }

    const workspace = await this.workspaceService.create(createWorkspaceDto, session.user.id);

    return WorkspaceDto.fromWorkspace(workspace);
  }

  @Get()
  @ApiOperation({
    summary: "List workspaces",
    operationId: "listWorkspaces",
  })
  @ApiResponse({
    status: 200,
    description: "List of workspaces",
    type: [WorkspaceDto],
  })
  async findAll(@Session() session: UserSession): Promise<WorkspaceDto[]> {
    const workspaces = await this.workspaceService.findByUser(session.user.id);
    return workspaces.map(WorkspaceDto.fromWorkspace);
  }

  @Get("/:workspaceId")
  @UseGuards(WorkspaceAccessGuard)
  @ApiOperation({
    summary: "Get workspace by ID",
    operationId: "getWorkspace",
  })
  @ApiResponse({
    status: 200,
    description: "Workspace details",
    type: WorkspaceDto,
  })
  @ApiParam({
    name: "workspaceId",
    description: "Workspace ID",
    type: "string",
  })
  async findOne(@CurrentWorkspace() workspace: Workspace): Promise<WorkspaceDto> {
    return WorkspaceDto.fromWorkspace(workspace);
  }

  @Delete("/:workspaceId")
  @UseGuards(WorkspaceActionGuard)
  @RequiredWorkspaceMemberRole(WorkspaceMemberRole.OWNER)
  @ApiOperation({
    summary: "Delete workspace",
    operationId: "deleteWorkspace",
  })
  @ApiResponse({
    status: 204,
    description: "Workspace deleted successfully",
  })
  @ApiParam({
    name: "workspaceId",
    description: "Workspace ID",
    type: "string",
  })
  async delete(@CurrentWorkspace() workspace: Workspace): Promise<void> {
    return this.workspaceService.delete(workspace.id);
  }
}
