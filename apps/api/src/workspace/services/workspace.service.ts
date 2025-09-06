import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "../../database/decorators";
import { Workspace } from "../../database/schema";
import { CreateWorkspaceDto } from "../dto/create-workspace-module.dto";
import { WorkspaceMemberRole } from "../enums/workspace-member-role.enum";
import { WorkspaceUserRepository } from "../repositories/workspace-user.repository";
import { WorkspaceRepository } from "../repositories/workspace.repository";

@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);

  constructor(
    @InjectRepository(WorkspaceRepository)
    private readonly workspaceRepository: WorkspaceRepository,
    @InjectRepository(WorkspaceUserRepository)
    private readonly workspaceUserRepository: WorkspaceUserRepository
  ) {}

  private readonly workspaceColors = ["#4F7BED", "#3FAF3F", "#8B5FBF", "#FF69B4", "#53EAFD"];

  private getRandomWorkspaceColor(): string {
    const randomIndex = Math.floor(Math.random() * this.workspaceColors.length);
    return this.workspaceColors[randomIndex];
  }

  async create(createWorkspaceDto: CreateWorkspaceDto, userId: string): Promise<Workspace> {
    const workspacesCount = await this.workspaceRepository.getCountByUserId(userId);
    if (workspacesCount >= 10) {
      throw new ForbiddenException(
        "You have reached the maximum amount of modules, upgrade for more"
      );
    }

    const createdWorkspace = await this.workspaceRepository.create({
      userId,
      name: createWorkspaceDto.name,
      classCode: createWorkspaceDto.classCode,
      color: this.getRandomWorkspaceColor(),
    });

    await this.workspaceUserRepository.create({
      workspaceId: createdWorkspace.id,
      userId,
      role: WorkspaceMemberRole.OWNER,
    });

    this.logger.log(`Created a new workspace: ${createdWorkspace}`);

    return createdWorkspace;
  }

  async findUserWorkspace(userId: string, workspaceId: string): Promise<Workspace> {
    return this.workspaceRepository.findSpecific(userId, workspaceId);
  }

  async findByUser(userId: string): Promise<Workspace[]> {
    return this.workspaceRepository.findByUserId(userId);
  }

  async delete(workspaceId: string): Promise<void> {
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    return this.workspaceRepository.delete(workspaceId);
  }
}
