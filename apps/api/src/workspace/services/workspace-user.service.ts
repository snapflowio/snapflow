import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { OnAsyncEvent } from "../../common/decorators/on-async-event.decorator";
import { InjectRepository } from "../../database/decorators";
import { NewWorkspaceUser, WorkspaceUser } from "../../database/schema";
import { UserEvents } from "../../user/constants/user-events.constant";
import { UserDeletedEvent } from "../../user/events/user-deleted.event";
import { UserService } from "../../user/user.service";
import { WorkspaceEvents } from "../constants/workspace-events.constant";
import { WorkspaceUserDto } from "../dto/workspace-user.dto";
import { WorkspaceMemberRole } from "../enums/workspace-member-role.enum";
import { WorkspaceInvitationAcceptedEvent } from "../events/workspace-invitation-accepted.event";
import { WorkspaceUserRepository } from "../repositories/workspace-user.repository";

@Injectable()
export class WorkspaceUserService {
  constructor(
    @InjectRepository(WorkspaceUserRepository)
    private readonly workspaceUserRepository: WorkspaceUserRepository,
    private readonly userService: UserService
  ) {}

  async findAll(workspaceId: string): Promise<WorkspaceUserDto[]> {
    const workspaceUsers = await this.workspaceUserRepository.findByWorkspaceId(workspaceId);
    const userIds = workspaceUsers.map((workspaceUser) => workspaceUser.userId);

    if (userIds.length === 0) return [];

    const users = await this.userService.findByIds(userIds);
    const userMap = new Map(users.map((user) => [user.id, user]));

    const dtos: WorkspaceUserDto[] = workspaceUsers.map((workspaceUser) => {
      const user = userMap.get(workspaceUser.userId);
      return WorkspaceUserDto.fromEntities(workspaceUser, user);
    });

    return dtos;
  }

  async findOne(workspaceId: string, userId: string): Promise<WorkspaceUser | null> {
    return this.workspaceUserRepository.findSpecific(workspaceId, userId);
  }

  async updateRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceMemberRole
  ): Promise<WorkspaceUserDto> {
    const workspaceUser = await this.workspaceUserRepository.findSpecific(workspaceId, userId);

    if (!workspaceUser) {
      throw new NotFoundException(
        `User with ID ${userId} not found in workspace with ID ${workspaceId}`
      );
    }

    // Check if we're removing the last owner
    if (workspaceUser.role === WorkspaceMemberRole.OWNER && role !== WorkspaceMemberRole.OWNER) {
      const ownersCount = await this.workspaceUserRepository.countByWorkspaceIdAndRole(
        workspaceId,
        WorkspaceMemberRole.OWNER
      );

      if (ownersCount === 1) {
        throw new ForbiddenException("The workspace must have at least one owner");
      }
    }

    const updatedWorkspaceUser = await this.workspaceUserRepository.updateRole(
      workspaceId,
      userId,
      role
    );

    const user = await this.userService.findOne(userId);

    return WorkspaceUserDto.fromEntities(updatedWorkspaceUser, user);
  }

  async create(
    workspaceId: string,
    userId: string,
    role: WorkspaceMemberRole
  ): Promise<WorkspaceUser> {
    const newWorkspaceUser: NewWorkspaceUser = {
      workspaceId,
      userId,
      role,
    };

    return this.workspaceUserRepository.create(newWorkspaceUser);
  }

  async delete(workspaceId: string, userId: string): Promise<void> {
    const workspaceUser = await this.workspaceUserRepository.findSpecific(workspaceId, userId);

    if (!workspaceUser) {
      throw new NotFoundException(
        `User with ID ${userId} not found in workspace with ID ${workspaceId}`
      );
    }

    await this.remove(workspaceUser);
  }

  private async remove(workspaceUser: WorkspaceUser, force = false): Promise<void> {
    if (!force && workspaceUser.role === WorkspaceMemberRole.OWNER) {
      const ownersCount = await this.workspaceUserRepository.countByWorkspaceIdAndRole(
        workspaceUser.workspaceId,
        WorkspaceMemberRole.OWNER
      );

      if (ownersCount === 1) {
        throw new ForbiddenException(
          `Workspace with ID ${workspaceUser.workspaceId} must have at least one owner`
        );
      }
    }

    await this.workspaceUserRepository.delete(workspaceUser.workspaceId, workspaceUser.userId);
  }

  @OnAsyncEvent({
    event: WorkspaceEvents.INVITATION_ACCEPTED,
  })
  async handleWorkspaceInvitationAcceptedEvent(
    payload: WorkspaceInvitationAcceptedEvent
  ): Promise<WorkspaceUser> {
    return this.create(payload.workspaceId, payload.userId, payload.role);
  }

  @OnAsyncEvent({
    event: UserEvents.DELETED,
  })
  async handleUserDeletedEvent(payload: UserDeletedEvent): Promise<void> {
    const memberships = await this.workspaceUserRepository.findByUserId(payload.userId);

    await Promise.all(memberships.map((membership) => this.remove(membership, true)));
  }
}
