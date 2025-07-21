import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { FindOptionsWhere, In, JsonContains, LessThan, Not, Repository } from "typeorm";
import { validate as uuidValidate } from "uuid";
import { BadRequestError } from "../../common/exceptions/bad-request.exception";
import { SandboxError } from "../../common/exceptions/sandbox-error.exception";
import { TypedConfigService } from "../../config/typed-config.service";
import { OrganizationEvents } from "../../organization/constants/organization-events.constant";
import { Organization } from "../../organization/entities/organization.entity";
import { OrganizationSuspendedSandboxStoppedEvent } from "../../organization/events/organization-suspended-sandbox-stopped.event";
import { OrganizationService } from "../../organization/services/organization.service";
import { SANDBOX_WARM_POOL_UNASSIGNED_ORGANIZATION } from "../constants/sandbox.constants";
import { SandboxEvents } from "../constants/sandbox-events.constants";
import { WarmPoolEvents } from "../constants/warmpool-events.constants";
import { CreateSandboxDto } from "../dto/create-sandbox.dto";
import { PortPreviewUrlDto } from "../dto/port-preview-url.dto";
import { SandboxDto } from "../dto/sandbox.dto";
import {
  BuildInfo,
  generateBuildInfoHash as generateBuildImageRef,
} from "../entities/build-info.entity";
import { Executor } from "../entities/executor.entity";
import { Image } from "../entities/image.entity";
import { Sandbox } from "../entities/sandbox.entity";
import { WarmPool } from "../entities/warm-pool.entity";
import { BackupState } from "../enums/backup-state.enum";
import { ExecutorRegion } from "../enums/executor-region.enum";
import { ExecutorState } from "../enums/executor-state.enum";
import { ImageState } from "../enums/image-state.enum";
import { SandboxClass } from "../enums/sandbox-class.enum";
import { SandboxDesiredState } from "../enums/sandbox-desired-state.enum";
import { SandboxState } from "../enums/sandbox-state.enum";
import { SandboxArchivedEvent } from "../events/sandbox-archived.event";
import { SandboxBackupCreatedEvent } from "../events/sandbox-backup-created.event";
import { SandboxDestroyedEvent } from "../events/sandbox-destroyed.event";
import { SandboxStartedEvent } from "../events/sandbox-started.event";
import { SandboxStateUpdatedEvent } from "../events/sandbox-state-updated.event";
import { SandboxStoppedEvent } from "../events/sandbox-stopped.event";
import { WarmPoolTopUpRequested } from "../events/warmpool-topup-requested.event";
import { ExecutorService } from "./executor.service";
import { SandboxWarmPoolService } from "./sandbox-warm-pool.service";

const DEFAULT_CPU = 1;
const DEFAULT_MEMORY = 1;
const DEFAULT_DISK = 3;
const DEFAULT_GPU = 0;

@Injectable()
export class SandboxService {
  private readonly logger = new Logger(SandboxService.name);

  constructor(
    @InjectRepository(Sandbox)
    private readonly sandboxRepository: Repository<Sandbox>,
    @InjectRepository(Image)
    private readonly imageRepository: Repository<Image>,
    @InjectRepository(Executor)
    private readonly executorRepository: Repository<Executor>,
    @InjectRepository(BuildInfo)
    private readonly buildInfoRepository: Repository<BuildInfo>,
    private readonly executorService: ExecutorService,
    private readonly configService: TypedConfigService,
    private readonly warmPoolService: SandboxWarmPoolService,
    private readonly eventEmitter: EventEmitter2,
    private readonly organizationService: OrganizationService
  ) {}

  private async validateOrganizationQuotas(
    organization: Organization,
    cpu: number,
    memory: number,
    disk: number,
    excludeSandboxId?: string
  ): Promise<void> {
    this.organizationService.assertOrganizationIsNotSuspended(organization);

    // Check per-sandbox resource limits
    if (cpu > organization.maxCpuPerSandbox) {
      throw new ForbiddenException(
        `CPU request ${cpu} exceeds maximum allowed per sandbox (${organization.maxCpuPerSandbox})`
      );
    }
    if (memory > organization.maxMemoryPerSandbox) {
      throw new ForbiddenException(
        `Memory request ${memory}GB exceeds maximum allowed per sandbox (${organization.maxMemoryPerSandbox}GB)`
      );
    }
    if (disk > organization.maxDiskPerSandbox) {
      throw new ForbiddenException(
        `Disk request ${disk}GB exceeds maximum allowed per sandbox (${organization.maxDiskPerSandbox}GB)`
      );
    }

    const ignoredStates = [
      SandboxState.DESTROYED,
      SandboxState.ARCHIVED,
      SandboxState.ERROR,
      SandboxState.BUILD_FAILED,
    ];

    const inactiveStates = [...ignoredStates, SandboxState.STOPPED, SandboxState.ARCHIVING];

    const resourceMetrics: {
      used_disk: number;
      used_cpu: number;
      used_mem: number;
    } = await this.sandboxRepository
      .createQueryBuilder("sandbox")
      .select([
        "SUM(CASE WHEN sandbox.state NOT IN (:...ignoredStates) THEN sandbox.disk ELSE 0 END) as used_disk",
        "SUM(CASE WHEN sandbox.state NOT IN (:...inactiveStates) THEN sandbox.cpu ELSE 0 END) as used_cpu",
        "SUM(CASE WHEN sandbox.state NOT IN (:...inactiveStates) THEN sandbox.mem ELSE 0 END) as used_mem",
      ])
      .where("sandbox.organizationId = :organizationId", {
        organizationId: organization.id,
      })
      .andWhere(
        excludeSandboxId ? "sandbox.id != :excludeSandboxId" : "1=1",
        excludeSandboxId ? { excludeSandboxId } : {}
      )
      .setParameter("ignoredStates", ignoredStates)
      .setParameter("inactiveStates", inactiveStates)
      .getRawOne();

    const usedDisk = Number(resourceMetrics.used_disk) || 0;
    const usedCpu = Number(resourceMetrics.used_cpu) || 0;
    const usedMem = Number(resourceMetrics.used_mem) || 0;

    if (usedDisk + disk > organization.totalDiskQuota) {
      throw new ForbiddenException(
        `Total disk quota exceeded (${usedDisk + disk}GB > ${organization.totalDiskQuota}GB)`
      );
    }

    // Check total resource quotas
    if (usedCpu + cpu > organization.totalCpuQuota) {
      throw new ForbiddenException(
        `Total CPU quota exceeded (${usedCpu + cpu} > ${organization.totalCpuQuota})`
      );
    }

    if (usedMem + memory > organization.totalMemoryQuota) {
      throw new ForbiddenException(
        `Total memory quota exceeded (${usedMem + memory}GB > ${organization.totalMemoryQuota}GB)`
      );
    }
  }

  async archive(sandboxId: string): Promise<void> {
    const sandbox = await this.sandboxRepository.findOne({
      where: {
        id: sandboxId,
      },
    });

    if (!sandbox) {
      throw new NotFoundException(`Sandbox with ID ${sandboxId} not found`);
    }

    if (String(sandbox.state) !== String(sandbox.desiredState)) {
      throw new SandboxError("State change in progress");
    }

    if (sandbox.state !== SandboxState.STOPPED) {
      throw new SandboxError("Sandbox is not stopped");
    }

    if (sandbox.pending) {
      throw new SandboxError("Sandbox state change in progress");
    }
    sandbox.pending = true;
    sandbox.desiredState = SandboxDesiredState.ARCHIVED;
    await this.sandboxRepository.save(sandbox);

    this.eventEmitter.emit(SandboxEvents.ARCHIVED, new SandboxArchivedEvent(sandbox));
  }

  async createForWarmPool(warmPoolItem: WarmPool): Promise<Sandbox> {
    const sandbox = new Sandbox();

    sandbox.organizationId = SANDBOX_WARM_POOL_UNASSIGNED_ORGANIZATION;

    sandbox.region = warmPoolItem.target;
    sandbox.class = warmPoolItem.class;
    sandbox.image = warmPoolItem.image;
    //  TODO: default user should be configurable
    sandbox.osUser = "snapflow";
    sandbox.env = warmPoolItem.env || {};

    sandbox.cpu = warmPoolItem.cpu;
    sandbox.gpu = warmPoolItem.gpu;
    sandbox.mem = warmPoolItem.mem;
    sandbox.disk = warmPoolItem.disk;

    const image = await this.imageRepository.findOne({
      where: [
        {
          organizationId: sandbox.organizationId,
          name: sandbox.image,
          state: ImageState.ACTIVE,
        },
        { general: true, name: sandbox.image, state: ImageState.ACTIVE },
      ],
    });
    if (!image) {
      throw new BadRequestError(
        `Image ${sandbox.image} not found while creating warm pool sandbox`
      );
    }

    const executor = await this.executorService.getRandomAvailableExecutor({
      region: sandbox.region,
      sandboxClass: sandbox.class,
      imageRef: image.internalName,
    });

    sandbox.executorId = executor.id;

    await this.sandboxRepository.insert(sandbox);
    return sandbox;
  }

  async createFromImage(
    createSandboxDto: CreateSandboxDto,
    organization: Organization,
    useSandboxResourceParams_deprecated?: boolean
  ): Promise<SandboxDto> {
    const region = this.getValidatedOrDefaultRegion(createSandboxDto.target);
    const sandboxClass = this.getValidatedOrDefaultClass(createSandboxDto.class);

    let imageIdOrName = createSandboxDto.image;

    if (!createSandboxDto.image?.trim()) {
      imageIdOrName = this.configService.getOrThrow("defaultImage");
    }

    const imageFilter: FindOptionsWhere<Image>[] = [
      { organizationId: organization.id, name: imageIdOrName },
      { general: true, name: imageIdOrName },
    ];

    if (uuidValidate(imageIdOrName)) {
      imageFilter.push(
        { organizationId: organization.id, id: imageIdOrName },
        { general: true, id: imageIdOrName }
      );
    }

    const images = await this.imageRepository.find({
      where: imageFilter,
    });

    if (images.length === 0) throw new BadRequestError(`Image ${imageIdOrName} not found.`);

    let image = images.find((s) => s.state === ImageState.ACTIVE);
    if (!image) image = images[0];

    if (image.state !== ImageState.ACTIVE) {
      throw new BadRequestError(`Image ${imageIdOrName} is ${image.state}`);
    }

    let cpu = image.cpu;
    let mem = image.mem;
    let disk = image.disk;
    let gpu = image.gpu;

    // Remove the deprecated behavior in a future release
    if (useSandboxResourceParams_deprecated) {
      if (createSandboxDto.cpu) {
        cpu = createSandboxDto.cpu;
      }
      if (createSandboxDto.memory) {
        mem = createSandboxDto.memory;
      }
      if (createSandboxDto.disk) {
        disk = createSandboxDto.disk;
      }
      if (createSandboxDto.gpu) {
        gpu = createSandboxDto.gpu;
      }
    }

    await this.validateOrganizationQuotas(organization, cpu, mem, disk);

    const warmPoolSandbox = await this.warmPoolService.fetchWarmPoolSandbox({
      organizationId: organization.id,
      image: imageIdOrName,
      target: createSandboxDto.target,
      class: createSandboxDto.class,
      cpu: cpu,
      mem: mem,
      disk: disk,
      osUser: createSandboxDto.user,
      env: createSandboxDto.env,
      state: SandboxState.STARTED,
    });

    if (warmPoolSandbox) {
      return await this.assignWarmPoolSandbox(warmPoolSandbox, createSandboxDto, organization.id);
    }

    console.log("YEEEEEEEEEEEEEEEEEEEEEEe");

    // LEVEL 1
    const executor = await this.executorService.getRandomAvailableExecutor({
      region,
      sandboxClass,
      imageRef: image.internalName,
    });

    console.log("EXE", executor);

    const sandbox = new Sandbox();

    sandbox.organizationId = organization.id;

    //  TODO: make configurable
    sandbox.region = region;
    sandbox.class = sandboxClass;
    sandbox.image = image.name;
    //  TODO: default user should be configurable
    sandbox.osUser = createSandboxDto.user || "snapflow";
    sandbox.env = createSandboxDto.env || {};
    sandbox.labels = createSandboxDto.labels || {};
    sandbox.buckets = createSandboxDto.buckets || [];

    sandbox.cpu = cpu;
    sandbox.gpu = gpu;
    sandbox.mem = mem;
    sandbox.disk = disk;

    sandbox.public = createSandboxDto.public || false;

    if (createSandboxDto.autoStopInterval !== undefined) {
      sandbox.autoStopInterval = createSandboxDto.autoStopInterval;
    }

    if (createSandboxDto.autoArchiveInterval !== undefined) {
      sandbox.autoArchiveInterval = this.resolveAutoArchiveInterval(
        createSandboxDto.autoArchiveInterval
      );
    }

    sandbox.executorId = executor.id;

    await this.sandboxRepository.insert(sandbox);
    return SandboxDto.fromSandbox(sandbox, executor.domain);
  }

  private async assignWarmPoolSandbox(
    warmPoolSandbox: Sandbox,
    createSandboxDto: CreateSandboxDto,
    organizationId: string
  ): Promise<SandboxDto> {
    warmPoolSandbox.public = createSandboxDto.public || false;
    warmPoolSandbox.labels = createSandboxDto.labels || {};
    warmPoolSandbox.organizationId = organizationId;
    warmPoolSandbox.createdAt = new Date();

    if (createSandboxDto.autoStopInterval !== undefined) {
      warmPoolSandbox.autoStopInterval = createSandboxDto.autoStopInterval;
    }

    if (createSandboxDto.autoArchiveInterval !== undefined) {
      warmPoolSandbox.autoArchiveInterval = this.resolveAutoArchiveInterval(
        createSandboxDto.autoArchiveInterval
      );
    }

    const executor = await this.executorService.findOne(warmPoolSandbox.executorId);

    const result = await this.sandboxRepository.save(warmPoolSandbox);

    // Treat this as a newly started sandbox
    this.eventEmitter.emit(
      SandboxEvents.STATE_UPDATED,
      new SandboxStateUpdatedEvent(warmPoolSandbox, SandboxState.STARTED, SandboxState.STARTED)
    );
    return SandboxDto.fromSandbox(result, executor.domain);
  }

  async createFromBuildInfo(
    createSandboxDto: CreateSandboxDto,
    organization: Organization
  ): Promise<SandboxDto> {
    const region = this.getValidatedOrDefaultRegion(createSandboxDto.target);
    const sandboxClass = this.getValidatedOrDefaultClass(createSandboxDto.class);

    const cpu = createSandboxDto.cpu || DEFAULT_CPU;
    const mem = createSandboxDto.memory || DEFAULT_MEMORY;
    const disk = createSandboxDto.disk || DEFAULT_DISK;
    const gpu = createSandboxDto.gpu || DEFAULT_GPU;

    await this.validateOrganizationQuotas(organization, cpu, mem, disk);

    const sandbox = new Sandbox();

    // sandbox = from

    sandbox.organizationId = organization.id;

    //  TODO: make configurable
    sandbox.region = region;
    sandbox.class = sandboxClass;
    //  TODO: default user should be configurable
    sandbox.osUser = createSandboxDto.user || "snapflow";
    sandbox.env = createSandboxDto.env || {};
    sandbox.labels = createSandboxDto.labels || {};
    sandbox.buckets = createSandboxDto.buckets || [];

    sandbox.cpu = cpu;
    sandbox.gpu = gpu;
    sandbox.mem = mem;
    sandbox.disk = disk;
    sandbox.public = createSandboxDto.public || false;

    if (createSandboxDto.autoStopInterval !== undefined) {
      sandbox.autoStopInterval = createSandboxDto.autoStopInterval;
    }

    if (createSandboxDto.autoArchiveInterval !== undefined) {
      sandbox.autoArchiveInterval = this.resolveAutoArchiveInterval(
        createSandboxDto.autoArchiveInterval
      );
    }

    const buildInfoImageRef = generateBuildImageRef(
      createSandboxDto.buildInfo.dockerfileContent,
      createSandboxDto.buildInfo.contextHashes
    );

    // Check if buildInfo with the same imageRef already exists
    const existingBuildInfo = await this.buildInfoRepository.findOne({
      where: { imageRef: buildInfoImageRef },
    });

    if (existingBuildInfo) {
      sandbox.buildInfo = existingBuildInfo;
      await this.buildInfoRepository.update(sandbox.buildInfo.imageRef, {
        lastUsedAt: new Date(),
      });
    } else {
      const buildInfoEntity = this.buildInfoRepository.create({
        ...createSandboxDto.buildInfo,
      });
      await this.buildInfoRepository.save(buildInfoEntity);
      sandbox.buildInfo = buildInfoEntity;
    }

    let executor: Executor;

    try {
      executor = await this.executorService.getRandomAvailableExecutor({
        region: sandbox.region,
        sandboxClass: sandbox.class,
        imageRef: sandbox.buildInfo.imageRef,
      });

      sandbox.executorId = executor.id;
    } catch (error) {
      if (
        error instanceof BadRequestError === false ||
        error.message !== "No available executors" ||
        !sandbox.buildInfo
      ) {
        throw error;
      }
      sandbox.state = SandboxState.PENDING_BUILD;
    }

    await this.sandboxRepository.insert(sandbox);
    return SandboxDto.fromSandbox(sandbox, executor?.domain);
  }

  async createBackup(sandboxId: string): Promise<void> {
    const sandbox = await this.sandboxRepository.findOne({
      where: {
        id: sandboxId,
      },
    });

    if (!sandbox) {
      throw new NotFoundException(`Sandbox with ID ${sandboxId} not found`);
    }

    if (![BackupState.COMPLETED, BackupState.NONE].includes(sandbox.backupState)) {
      throw new SandboxError("Sandbox backup is already in progress");
    }

    await this.sandboxRepository.update(sandboxId, {
      backupState: BackupState.PENDING,
    });

    this.eventEmitter.emit(SandboxEvents.BACKUP_CREATED, new SandboxBackupCreatedEvent(sandbox));
  }

  async findAll(
    organizationId: string,
    labels?: { [key: string]: string },
    includeErroredDestroyed?: boolean
  ): Promise<Sandbox[]> {
    const baseFindOptions: FindOptionsWhere<Sandbox> = {
      organizationId,
      ...(labels ? { labels: JsonContains(labels) } : {}),
    };

    const where: FindOptionsWhere<Sandbox>[] = [
      {
        ...baseFindOptions,
        state: Not(In([SandboxState.DESTROYED, SandboxState.ERROR, SandboxState.BUILD_FAILED])),
      },
      {
        ...baseFindOptions,
        state: In([SandboxState.ERROR, SandboxState.BUILD_FAILED]),
        ...(includeErroredDestroyed ? {} : { desiredState: Not(SandboxDesiredState.DESTROYED) }),
      },
    ];

    return this.sandboxRepository.find({ where });
  }

  async findOne(sandboxId: string, returnDestroyed?: boolean): Promise<Sandbox> {
    const sandbox = await this.sandboxRepository.findOne({
      where: {
        id: sandboxId,
        ...(returnDestroyed ? {} : { state: Not(SandboxState.DESTROYED) }),
      },
    });

    if (
      !sandbox ||
      (!returnDestroyed &&
        [SandboxState.ERROR, SandboxState.BUILD_FAILED].includes(sandbox.state) &&
        sandbox.desiredState !== SandboxDesiredState.DESTROYED)
    ) {
      throw new NotFoundException(`Sandbox with ID ${sandboxId} not found`);
    }

    return sandbox;
  }

  async getPortPreviewUrl(sandboxId: string, port: number): Promise<PortPreviewUrlDto> {
    if (port < 1 || port > 65535) {
      throw new BadRequestError("Invalid port");
    }

    const sandbox = await this.sandboxRepository.findOne({
      where: { id: sandboxId },
    });

    if (!sandbox) {
      throw new NotFoundException(`Sandbox with ID ${sandboxId} not found`);
    }

    // Validate sandbox is in valid state
    if (sandbox.state !== SandboxState.STARTED) {
      throw new SandboxError("Sandbox must be started to get port preview URL");
    }

    // Get executor info
    const executor = await this.executorService.findOne(sandbox.executorId);
    if (!executor) {
      throw new NotFoundException(`Executor not found for sandbox ${sandboxId}`);
    }

    return {
      url: `https://${port}-${sandbox.id}.${executor.domain}`,
      token: sandbox.authToken,
    };
  }

  async destroy(sandboxId: string): Promise<void> {
    const sandbox = await this.sandboxRepository.findOne({
      where: {
        id: sandboxId,
      },
    });

    if (!sandbox) {
      throw new NotFoundException(`Sandbox with ID ${sandboxId} not found`);
    }

    if (sandbox.pending) {
      throw new SandboxError("Sandbox state change in progress");
    }
    sandbox.pending = true;
    sandbox.desiredState = SandboxDesiredState.DESTROYED;
    await this.sandboxRepository.save(sandbox);

    this.eventEmitter.emit(SandboxEvents.DESTROYED, new SandboxDestroyedEvent(sandbox));
  }

  async start(sandboxId: string, organization: Organization): Promise<void> {
    const sandbox = await this.sandboxRepository.findOne({
      where: {
        id: sandboxId,
      },
    });

    if (!sandbox) {
      throw new NotFoundException(`Sandbox with ID ${sandboxId} not found`);
    }

    if (String(sandbox.state) !== String(sandbox.desiredState)) {
      throw new SandboxError("State change in progress");
    }

    if (![SandboxState.STOPPED, SandboxState.ARCHIVED].includes(sandbox.state)) {
      throw new SandboxError("Sandbox is not in valid state");
    }

    this.organizationService.assertOrganizationIsNotSuspended(organization);

    if (sandbox.executorId) {
      // Add executor readiness check
      const executor = await this.executorService.findOne(sandbox.executorId);
      if (executor.state !== ExecutorState.READY) {
        throw new SandboxError("Executor is not ready");
      }
    } else {
      //  restore operation
      //  like a new sandbox creation, we need to validate quotas
      await this.validateOrganizationQuotas(
        organization,
        sandbox.cpu,
        sandbox.mem,
        sandbox.disk,
        sandbox.id
      );
    }

    if (sandbox.pending) {
      throw new SandboxError("Sandbox state change in progress");
    }

    sandbox.pending = true;
    sandbox.desiredState = SandboxDesiredState.STARTED;
    await this.sandboxRepository.save(sandbox);

    this.eventEmitter.emit(SandboxEvents.STARTED, new SandboxStartedEvent(sandbox));
  }

  async stop(sandboxId: string): Promise<void> {
    const sandbox = await this.sandboxRepository.findOne({
      where: {
        id: sandboxId,
      },
    });

    if (!sandbox) {
      throw new NotFoundException(`Sandbox with ID ${sandboxId} not found`);
    }

    if (String(sandbox.state) !== String(sandbox.desiredState)) {
      throw new SandboxError("State change in progress");
    }

    if (sandbox.state !== SandboxState.STARTED) {
      throw new SandboxError("Sandbox is not started");
    }

    if (sandbox.pending) {
      throw new SandboxError("Sandbox state change in progress");
    }
    sandbox.pending = true;
    sandbox.desiredState = SandboxDesiredState.STOPPED;
    await this.sandboxRepository.save(sandbox);

    this.eventEmitter.emit(SandboxEvents.STOPPED, new SandboxStoppedEvent(sandbox));
  }

  async updatePublicStatus(sandboxId: string, isPublic: boolean): Promise<void> {
    const sandbox = await this.sandboxRepository.findOne({
      where: { id: sandboxId },
    });

    if (!sandbox) {
      throw new NotFoundException(`Sandbox with ID ${sandboxId} not found`);
    }

    sandbox.public = isPublic;
    await this.sandboxRepository.save(sandbox);
  }

  private getValidatedOrDefaultRegion(region: ExecutorRegion): ExecutorRegion {
    if (!region) return ExecutorRegion.US;

    if (Object.values(ExecutorRegion).includes(region)) return region;

    throw new BadRequestError("Invalid region");
  }

  private getValidatedOrDefaultClass(sandboxClass: SandboxClass): SandboxClass {
    if (!sandboxClass) return SandboxClass.SMALL;

    if (Object.values(SandboxClass).includes(sandboxClass)) return sandboxClass;
    throw new BadRequestError("Invalid class");
  }

  async replaceLabels(
    sandboxId: string,
    labels: { [key: string]: string }
  ): Promise<{ [key: string]: string }> {
    const sandbox = await this.sandboxRepository.findOne({
      where: { id: sandboxId },
    });

    if (!sandbox) {
      throw new NotFoundException(`Sandbox with ID ${sandboxId} not found`);
    }

    // Replace all labels
    sandbox.labels = labels;
    await this.sandboxRepository.save(sandbox);

    return sandbox.labels;
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanupDestroyedSandboxs() {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const destroyedSandboxs = await this.sandboxRepository.delete({
      state: SandboxState.DESTROYED,
      updatedAt: LessThan(twentyFourHoursAgo),
    });

    if (destroyedSandboxs.affected > 0) {
      this.logger.debug(`Cleaned up ${destroyedSandboxs.affected} destroyed sandboxs`);
    }
  }

  async setAutostopInterval(sandboxId: string, interval: number): Promise<void> {
    const sandbox = await this.sandboxRepository.findOne({
      where: { id: sandboxId },
    });

    if (!sandbox) {
      throw new NotFoundException(`Sandbox with ID ${sandboxId} not found`);
    }

    // Validate interval is non-negative
    if (interval < 0) {
      throw new BadRequestError("Auto-stop interval must be non-negative");
    }

    sandbox.autoStopInterval = interval;
    await this.sandboxRepository.save(sandbox);
  }

  async setAutoArchiveInterval(sandboxId: string, interval: number): Promise<void> {
    const sandbox = await this.sandboxRepository.findOne({
      where: { id: sandboxId },
    });

    if (!sandbox) {
      throw new NotFoundException(`Sandbox with ID ${sandboxId} not found`);
    }

    sandbox.autoArchiveInterval = this.resolveAutoArchiveInterval(interval);
    await this.sandboxRepository.save(sandbox);
  }

  @OnEvent(WarmPoolEvents.TOPUP_REQUESTED)
  private async createWarmPoolSandbox(event: WarmPoolTopUpRequested) {
    await this.createForWarmPool(event.warmPool);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  private async handleUnschedulableExecutors() {
    const executors = await this.executorRepository.find({
      where: { unschedulable: true },
    });

    if (executors.length === 0) {
      return;
    }

    //  find all sandboxs that are using the unschedulable executors and have organizationId = '00000000-0000-0000-0000-000000000000'
    const sandboxs = await this.sandboxRepository.find({
      where: {
        executorId: In(executors.map((executor) => executor.id)),
        organizationId: "00000000-0000-0000-0000-000000000000",
        state: SandboxState.STARTED,
        desiredState: Not(SandboxDesiredState.DESTROYED),
      },
    });

    if (sandboxs.length === 0) {
      return;
    }

    const destroyPromises = sandboxs.map((sandbox) => this.destroy(sandbox.id));
    const results = await Promise.allSettled(destroyPromises);

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        this.logger.error(`Failed to destroy sandbox ${sandboxs[index].id}: ${result.reason}`);
      }
    });
  }

  async isSandboxPublic(sandboxId: string): Promise<boolean> {
    const sandbox = await this.sandboxRepository.findOne({
      where: { id: sandboxId },
    });

    if (!sandbox) {
      throw new NotFoundException(`Sandbox with ID ${sandboxId} not found`);
    }

    return sandbox.public;
  }

  @OnEvent(OrganizationEvents.SUSPENDED_SANDBOX_STOPPED)
  async handleSuspendedSandboxStopped(event: OrganizationSuspendedSandboxStoppedEvent) {
    await this.stop(event.sandboxId).catch((error) => {
      //  log the error for now, but don't throw it as it will be retried
      this.logger.error(
        `Error stopping sandbox from suspended organization. SandboxId: ${event.sandboxId}: `,
        error
      );
    });
  }

  private resolveAutoArchiveInterval(autoArchiveInterval: number): number {
    if (autoArchiveInterval < 0) {
      throw new BadRequestError("Auto-archive interval must be non-negative");
    }

    const maxAutoArchiveInterval = this.configService.getOrThrow("maxAutoArchiveInterval");

    if (autoArchiveInterval === 0) {
      return maxAutoArchiveInterval;
    }

    return Math.min(autoArchiveInterval, maxAutoArchiveInterval);
  }
}
