import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "../../database/decorators";
import { WorkspaceInvitation, WorkspaceInvitationWithWorkspace } from "../../database/schema";
import { UserService } from "../../user/user.service";
import { WorkspaceEvents } from "../constants/workspace-events.constant";
import { CreateWorkspaceInvitationDto } from "../dto/create-workspace-invitation.dto";
import { UpdateWorkspaceInvitationDto } from "../dto/update-workspace-invitation.dto";
import { WorkspaceInvitationStatus } from "../enums/workspace-invitation-status.enum";
import { WorkspaceInvitationCreatedEvent } from "../events/workspace-invitation-created.event";
import { WorkspaceInvitationRepository } from "../repositories/workspace-invitation.repository";
import { WorkspaceUserService } from "./workspace-user.service";
import { WorkspaceService } from "./workspace.service";

@Injectable()
export class WorkspaceInvitationService {
  private readonly logger = new Logger(WorkspaceInvitationService.name);

  constructor(
    @InjectRepository(WorkspaceInvitationRepository)
    private readonly workspaceInvitationRepository: WorkspaceInvitationRepository,
    private readonly workspaceService: WorkspaceService,
    private readonly workspaceUserService: WorkspaceUserService,
    private readonly userService: UserService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async create(
    workspaceId: string,
    createWorkspaceInvitationDto: CreateWorkspaceInvitationDto,
    invitedByUserId: string
  ): Promise<WorkspaceInvitation> {
    const workspace = await this.workspaceService.findUserWorkspace(invitedByUserId, workspaceId);
    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${workspaceId} not found`);
    }

    // Get inviter's email for the invitedBy field
    const inviter = await this.userService.findOne(invitedByUserId);
    if (!inviter) {
      throw new NotFoundException(`Inviter user with ID ${invitedByUserId} not found`);
    }

    const existingUser = await this.userService.findOneByEmail(createWorkspaceInvitationDto.email);

    if (existingUser) {
      const workspaceUser = await this.workspaceUserService.findOne(workspaceId, existingUser.id);
      if (workspaceUser) {
        throw new ConflictException(
          `User with email ${createWorkspaceInvitationDto.email} is already a member of this workspace`
        );
      }
    }

    const existingInvitation =
      await this.workspaceInvitationRepository.findExistingPendingInvitation(
        workspaceId,
        createWorkspaceInvitationDto.email
      );

    if (existingInvitation) {
      throw new ConflictException(
        `User with email "${createWorkspaceInvitationDto.email}" already invited to this workspace`
      );
    }

    const invitation = await this.workspaceInvitationRepository.create({
      workspaceId,
      email: createWorkspaceInvitationDto.email,
      role: createWorkspaceInvitationDto.role,
      expiresAt:
        createWorkspaceInvitationDto.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      invitedBy: inviter.email,
      status: WorkspaceInvitationStatus.PENDING,
    });

    // Emit invitation created event
    this.eventEmitter.emit(
      WorkspaceEvents.INVITATION_CREATED,
      new WorkspaceInvitationCreatedEvent(
        workspace.name,
        inviter.email,
        invitation.email,
        invitation.id,
        invitation.expiresAt
      )
    );

    this.logger.log(`Created workspace invitation: ${invitation.id} for ${invitation.email}`);

    return invitation;
  }

  async update(
    invitationId: string,
    updateWorkspaceInvitationDto: UpdateWorkspaceInvitationDto
  ): Promise<WorkspaceInvitation> {
    const invitation = await this.workspaceInvitationRepository.findById(invitationId);

    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${invitationId} not found`);
    }

    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      throw new ForbiddenException(`Invitation with ID ${invitationId} is expired`);
    }

    if (invitation.status !== WorkspaceInvitationStatus.PENDING) {
      throw new ForbiddenException(
        `Invitation with ID ${invitationId} is already ${invitation.status}`
      );
    }

    return this.workspaceInvitationRepository.update(invitationId, {
      role: updateWorkspaceInvitationDto.role,
      expiresAt: updateWorkspaceInvitationDto.expiresAt,
    });
  }

  async findPending(workspaceId: string): Promise<WorkspaceInvitationWithWorkspace[]> {
    return this.workspaceInvitationRepository.findPendingByWorkspaceId(workspaceId);
  }

  async findByUser(userId: string): Promise<WorkspaceInvitationWithWorkspace[]> {
    const user = await this.userService.findOne(userId);

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return this.workspaceInvitationRepository.findPendingByEmail(user.email);
  }

  async getCountByUser(userId: string): Promise<number> {
    const user = await this.userService.findOne(userId);

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return this.workspaceInvitationRepository.countPendingByEmail(user.email);
  }

  async findOneOrFail(invitationId: string): Promise<WorkspaceInvitationWithWorkspace> {
    const invitation = await this.workspaceInvitationRepository.findById(invitationId);

    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${invitationId} not found`);
    }

    return invitation;
  }

  async accept(invitationId: string, userId: string): Promise<void> {
    const invitation = await this.prepareStatusUpdate(invitationId);

    // Update invitation status and create workspace user membership
    await this.workspaceInvitationRepository.updateStatus(
      invitationId,
      WorkspaceInvitationStatus.ACCEPTED
    );
    await this.workspaceUserService.create(invitation.workspaceId, userId, invitation.role);

    this.logger.log(`User ${userId} accepted invitation ${invitationId}`);
  }

  async decline(invitationId: string): Promise<void> {
    await this.prepareStatusUpdate(invitationId);
    await this.workspaceInvitationRepository.updateStatus(
      invitationId,
      WorkspaceInvitationStatus.DECLINED
    );

    this.logger.log(`Invitation ${invitationId} declined`);
  }

  async cancel(invitationId: string): Promise<void> {
    await this.prepareStatusUpdate(invitationId);
    await this.workspaceInvitationRepository.updateStatus(
      invitationId,
      WorkspaceInvitationStatus.CANCELLED
    );

    this.logger.log(`Invitation ${invitationId} cancelled`);
  }

  private async prepareStatusUpdate(
    invitationId: string
  ): Promise<WorkspaceInvitationWithWorkspace> {
    const invitation = await this.workspaceInvitationRepository.findById(invitationId);

    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${invitationId} not found`);
    }

    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      throw new ForbiddenException(`Invitation with ID ${invitationId} is expired`);
    }

    if (invitation.status !== WorkspaceInvitationStatus.PENDING) {
      throw new ForbiddenException(
        `Invitation with ID ${invitationId} is already ${invitation.status}`
      );
    }

    return invitation;
  }
}
