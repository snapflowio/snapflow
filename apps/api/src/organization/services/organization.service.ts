import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { InjectRedis } from "@nestjs-modules/ioredis";
import { Redis } from "ioredis";
import {
  EntityManager,
  IsNull,
  LessThan,
  MoreThan,
  Or,
  Repository,
} from "typeorm";

import { DEFAULT_ORGANIZATION_QUOTA } from "../../common/constants/quota.constants";
import { OnAsyncEvent } from "../../common/decorators/on-async-event.decorator";
import { UserEvents } from "../../user/constants/user-events.constant";
import { UserCreatedEvent } from "../../user/events/user-created.event";
import { UserDeletedEvent } from "../../user/events/user-deleted.event";
import { UserEmailVerifiedEvent } from "../../user/events/user-email-verified.event";
import { OrganizationEvents } from "../constants/organization-events.constant";
import { CreateOrganizationDto } from "../dto/create-organization.dto";
import { CreateOrganizationQuotaDto } from "../dto/create-organization-quota.dto";
import { UpdateOrganizationQuotaDto } from "../dto/update-organization-quota.dto";
import { Organization } from "../entities/organization.entity";
import { OrganizationUser } from "../entities/organization-user.entity";
import { OrganizationMemberRole } from "../enums/organization-member-role.enum";

@Injectable()
export class OrganizationService implements OnModuleInit {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {}

  async create(
    createOrganizationDto: CreateOrganizationDto,
    createdBy: string,
    personal = false,
    creatorEmailVerified = false,
  ): Promise<Organization> {
    return this.createWithEntityManager(
      this.organizationRepository.manager,
      createOrganizationDto,
      createdBy,
      creatorEmailVerified,
      personal,
    );
  }

  async findByUser(userId: string): Promise<Organization[]> {
    return this.organizationRepository.find({
      where: {
        users: {
          userId,
        },
      },
    });
  }

  async findOne(organizationId: string): Promise<Organization | null> {
    return this.organizationRepository.findOne({
      where: { id: organizationId },
    });
  }

  async findSuspended(
    suspendedBefore?: Date,
    suspendedAfter?: Date,
    take?: number,
  ): Promise<Organization[]> {
    return this.organizationRepository.find({
      where: {
        suspended: true,
        suspendedUntil: Or(IsNull(), MoreThan(new Date())),
        ...(suspendedBefore ? { suspendedAt: LessThan(suspendedBefore) } : {}),
        ...(suspendedAfter ? { suspendedAt: MoreThan(suspendedAfter) } : {}),
      },
      //  limit the number of organizations to avoid memory issues
      take: take || 100,
    });
  }

  async findPersonal(userId: string): Promise<Organization> {
    return this.findPersonalWithEntityManager(
      this.organizationRepository.manager,
      userId,
    );
  }

  async delete(organizationId: string): Promise<void> {
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!organization)
      throw new NotFoundException(
        `Organization with ID ${organizationId} not found`,
      );

    return this.removeWithEntityManager(
      this.organizationRepository.manager,
      organization,
    );
  }

  async updateQuota(
    organizationId: string,
    updateOrganizationQuotaDto: UpdateOrganizationQuotaDto,
  ): Promise<Organization> {
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!organization)
      throw new NotFoundException(
        `Organization with ID ${organizationId} not found`,
      );

    organization.totalCpuQuota =
      updateOrganizationQuotaDto.totalCpuQuota ?? organization.totalCpuQuota;
    organization.totalMemoryQuota =
      updateOrganizationQuotaDto.totalMemoryQuota ??
      organization.totalMemoryQuota;
    organization.totalDiskQuota =
      updateOrganizationQuotaDto.totalDiskQuota ?? organization.totalDiskQuota;
    organization.maxCpuPerSandbox =
      updateOrganizationQuotaDto.maxCpuPerSandbox ??
      organization.maxCpuPerSandbox;
    organization.maxMemoryPerSandbox =
      updateOrganizationQuotaDto.maxMemoryPerSandbox ??
      organization.maxMemoryPerSandbox;
    organization.maxDiskPerSandbox =
      updateOrganizationQuotaDto.maxDiskPerSandbox ??
      organization.maxDiskPerSandbox;
    organization.maxSnapshotSize =
      updateOrganizationQuotaDto.maxSnapshotSize ??
      organization.maxSnapshotSize;
    organization.volumeQuota =
      updateOrganizationQuotaDto.volumeQuota ?? organization.volumeQuota;
    organization.snapshotQuota =
      updateOrganizationQuotaDto.snapshotQuota ?? organization.snapshotQuota;
    return this.organizationRepository.save(organization);
  }

  async suspend(
    organizationId: string,
    suspensionReason?: string,
    suspendedUntil?: Date,
  ): Promise<void> {
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!organization)
      throw new NotFoundException(
        `Organization with ID ${organizationId} not found`,
      );

    organization.suspended = true;
    organization.suspensionReason = suspensionReason || null;
    organization.suspendedUntil = suspendedUntil || null;
    organization.suspendedAt = new Date();
    await this.organizationRepository.save(organization);
  }

  async unsuspend(organizationId: string): Promise<void> {
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!organization)
      throw new NotFoundException(
        `Organization with ID ${organizationId} not found`,
      );

    organization.suspended = false;
    organization.suspensionReason = null;
    organization.suspendedUntil = null;
    organization.suspendedAt = null;

    await this.organizationRepository.save(organization);
  }

  private async createWithEntityManager(
    entityManager: EntityManager,
    createOrganizationDto: CreateOrganizationDto,
    createdBy: string,
    creatorEmailVerified: boolean,
    personal = false,
    quota: CreateOrganizationQuotaDto = DEFAULT_ORGANIZATION_QUOTA,
  ): Promise<Organization> {
    if (personal) {
      const count = await entityManager.count(Organization, {
        where: { createdBy, personal: true },
      });

      if (count > 0)
        throw new ForbiddenException("Personal organization already exists");
    }

    const createdCount = await entityManager.count(Organization, {
      where: { createdBy },
    });

    if (createdCount >= 10)
      throw new ForbiddenException(
        "You have reached the maximum number of created organizations",
      );

    let organization = new Organization();

    organization.name = createOrganizationDto.name;
    organization.createdBy = createdBy;
    organization.personal = personal;

    organization.totalCpuQuota = quota.totalCpuQuota;
    organization.totalMemoryQuota = quota.totalMemoryQuota;
    organization.totalDiskQuota = quota.totalDiskQuota;
    organization.maxCpuPerSandbox = quota.maxCpuPerSandbox;
    organization.maxMemoryPerSandbox = quota.maxMemoryPerSandbox;
    organization.maxDiskPerSandbox = quota.maxDiskPerSandbox;
    organization.snapshotQuota = quota.snapshotQuota;
    organization.maxSnapshotSize = quota.maxSnapshotSize;
    organization.volumeQuota = quota.volumeQuota;

    if (!creatorEmailVerified) {
      organization.suspended = true;
      organization.suspendedAt = new Date();
      organization.suspensionReason = "Please verify your email address";
    } else if (
      this.configService.get<boolean>("BILLING_ENABLED") &&
      !personal
    ) {
      organization.suspended = true;
      organization.suspendedAt = new Date();
      organization.suspensionReason = "Payment method required";
    }

    const owner = new OrganizationUser();
    owner.userId = createdBy;
    owner.role = OrganizationMemberRole.OWNER;

    organization.users = [owner];

    await entityManager.transaction(async (em) => {
      organization = await em.save(organization);
      await this.eventEmitter.emitAsync(
        OrganizationEvents.CREATED,
        organization,
      );
    });

    return organization;
  }

  private async removeWithEntityManager(
    entityManager: EntityManager,
    organization: Organization,
    force = false,
  ): Promise<void> {
    if (!force) {
      if (organization.personal)
        throw new ForbiddenException("Cannot delete personal organization");
    }

    await entityManager.remove(organization);
  }

  private async unsuspendPersonalWithEntityManager(
    entityManager: EntityManager,
    userId: string,
  ): Promise<void> {
    const organization = await this.findPersonalWithEntityManager(
      entityManager,
      userId,
    );

    organization.suspended = false;
    organization.suspendedAt = null;
    organization.suspensionReason = null;
    organization.suspendedUntil = null;
    await entityManager.save(organization);
  }

  private async findPersonalWithEntityManager(
    entityManager: EntityManager,
    userId: string,
  ): Promise<Organization> {
    const organization = await entityManager.findOne(Organization, {
      where: { createdBy: userId, personal: true },
    });

    if (!organization)
      throw new NotFoundException(
        `Personal organization for user ${userId} not found`,
      );

    return organization;
  }

  @OnAsyncEvent({
    event: UserEvents.CREATED,
  })
  async handleUserCreatedEvent(
    payload: UserCreatedEvent,
  ): Promise<Organization> {
    return this.createWithEntityManager(
      payload.entityManager,
      {
        name: "Personal",
      },
      payload.userId,
      payload.emailVerified || false,
      true,
      payload.personalOrganizationQuota,
    );
  }

  @OnAsyncEvent({
    event: UserEvents.EMAIL_VERIFIED,
  })
  async handleUserEmailVerifiedEvent(
    payload: UserEmailVerifiedEvent,
  ): Promise<void> {
    await this.unsuspendPersonalWithEntityManager(
      payload.entityManager,
      payload.userId,
    );
  }

  @OnAsyncEvent({
    event: UserEvents.DELETED,
  })
  async handleUserDeletedEvent(payload: UserDeletedEvent): Promise<void> {
    const organization = await this.findPersonalWithEntityManager(
      payload.entityManager,
      payload.userId,
    );

    await this.removeWithEntityManager(
      payload.entityManager,
      organization,
      true,
    );
  }

  assertOrganizationIsNotSuspended(organization: Organization): void {
    if (!organization.suspended) return;

    if (
      organization.suspendedUntil
        ? organization.suspendedUntil > new Date()
        : true
    ) {
      if (organization.suspensionReason)
        throw new ForbiddenException(
          `Organization is suspended: ${organization.suspensionReason}`,
        );

      throw new ForbiddenException("Organization is suspended");
    }
  }
}
