import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { FindOptionsWhere, In, Not, Raw, Repository } from "typeorm";
import { BadRequestError } from "../../common/exceptions/bad-request.exception";
import { ExecutorAdapterFactory, ExecutorInfo } from "../adapter/adapter";
import { SandboxEvents } from "../constants/sandbox-events.constants";
import { CreateExecutorDto } from "../dto/create-executor.dto";
import { ExecutorImageDto } from "../dto/executor-image.dto";
import { Executor } from "../entities/executor.entity";
import { Image } from "../entities/image.entity";
import { ImageExecutor } from "../entities/image-executor.entity";
import { Sandbox } from "../entities/sandbox.entity";
import { ExecutorState } from "../enums/executor-state.enum";
import { ImageExecutorState } from "../enums/image-executor-state.enum";
import { SandboxClass } from "../enums/sandbox-class.enum";
import { SandboxState } from "../enums/sandbox-state.enum";
import { SandboxStateUpdatedEvent } from "../events/sandbox-state-updated.event";

@Injectable()
export class ExecutorService {
  private readonly logger = new Logger(ExecutorService.name);
  private checkingExecutors = false;

  constructor(
    @InjectRepository(Executor)
    private readonly executorRepository: Repository<Executor>,
    private readonly executorAdapterFactory: ExecutorAdapterFactory,
    @InjectRepository(Sandbox)
    private readonly sandboxRepository: Repository<Sandbox>,
    @InjectRepository(ImageExecutor)
    private readonly imageExecutorRepository: Repository<ImageExecutor>,
    @InjectRepository(Image)
    private readonly imageRepository: Repository<Image>
  ) {}

  async create(createExecutorDto: CreateExecutorDto): Promise<Executor> {
    // Validate region and class
    if (createExecutorDto.region.trim().length === 0) {
      throw new Error("Invalid region");
    }
    if (!this.isValidClass(createExecutorDto.class)) {
      throw new Error("Invalid class");
    }

    const executor = new Executor();
    executor.domain = createExecutorDto.domain;
    executor.apiUrl = createExecutorDto.apiUrl;
    executor.proxyUrl = createExecutorDto.proxyUrl;
    executor.apiKey = createExecutorDto.apiKey;
    executor.cpu = createExecutorDto.cpu;
    executor.memory = createExecutorDto.memory;
    executor.disk = createExecutorDto.disk;
    executor.gpu = createExecutorDto.gpu;
    executor.gpuType = createExecutorDto.gpuType;
    executor.used = 0;
    executor.capacity = createExecutorDto.capacity;
    executor.region = createExecutorDto.region;
    executor.class = createExecutorDto.class;
    executor.version = createExecutorDto.version;

    return this.executorRepository.save(executor);
  }

  async findAll(): Promise<Executor[]> {
    return this.executorRepository.find();
  }

  async findOne(id: string): Promise<Executor | null> {
    return this.executorRepository.findOneBy({ id });
  }

  async findByIds(executorIds: string[]): Promise<Executor[]> {
    if (executorIds.length === 0) {
      return [];
    }

    return this.executorRepository.find({
      where: { id: In(executorIds) },
    });
  }

  async findBySandboxId(sandboxId: string): Promise<Executor | null> {
    const sandbox = await this.sandboxRepository.findOneBy({
      id: sandboxId,
      state: Not(SandboxState.DESTROYED),
    });
    if (!sandbox) {
      throw new NotFoundException(`Sandbox with ID ${sandboxId} not found`);
    }
    if (!sandbox.executorId) {
      throw new NotFoundException(`Sandbox with ID ${sandboxId} does not have a executor`);
    }

    return this.executorRepository.findOneBy({ id: sandbox.executorId });
  }

  async findAvailableExecutors(params: GetExecutorParams): Promise<Executor[]> {
    const executorFilter: FindOptionsWhere<Executor> = {
      state: ExecutorState.READY,
      unschedulable: Not(true),
      used: Raw((alias) => `${alias} < capacity`),
    };

    if (params.imageRef !== undefined) {
      const imageExecutors = await this.imageExecutorRepository.find({
        where: {
          state: ImageExecutorState.READY,
          imageRef: params.imageRef,
        },
      });

      let executorIds = imageExecutors.map((imageExecutor) => imageExecutor.executorId);

      if (params.excludedExecutorIds?.length) {
        executorIds = executorIds.filter((id) => !params.excludedExecutorIds.includes(id));
      }

      if (!executorIds.length) {
        return [];
      }

      executorFilter.id = In(executorIds);
    } else if (params.excludedExecutorIds?.length) {
      executorFilter.id = Not(In(params.excludedExecutorIds));
    }

    if (params.sandboxClass !== undefined) {
      executorFilter.class = params.sandboxClass;
    }

    const executors = await this.executorRepository.find({
      where: executorFilter,
    });

    return executors.sort((a, b) => a.used / a.capacity - b.used / b.capacity).slice(0, 10);
  }

  async remove(id: string): Promise<void> {
    await this.executorRepository.delete(id);
  }

  @OnEvent(SandboxEvents.STATE_UPDATED)
  async handleSandboxStateUpdate(event: SandboxStateUpdatedEvent) {
    if (
      ![SandboxState.DESTROYED, SandboxState.CREATING, SandboxState.ARCHIVED].includes(
        event.newState
      )
    ) {
      return;
    }

    await this.recalculateExecutorUsage(event.sandbox.executorId);
  }

  private async updateExecutorState(executorId: string, newState: ExecutorState): Promise<void> {
    const executor = await this.executorRepository.findOne({ where: { id: executorId } });
    if (!executor) {
      this.logger.error(`Executor ${executorId} not found when trying to update state`);
      return;
    }

    // Don't change state if executor is decommissioned
    if (executor.state === ExecutorState.DECOMMISSIONED) {
      this.logger.debug(`Executor ${executorId} is decommissioned, not updating state`);
      return;
    }

    await this.executorRepository.update(executorId, {
      state: newState,
      lastChecked: new Date(),
    });
  }

  @Cron("45 * * * * *")
  private async handleCheckExecutors() {
    if (this.checkingExecutors) {
      return;
    }
    this.checkingExecutors = true;
    const executors = await this.executorRepository.find({
      where: {
        state: Not(ExecutorState.DECOMMISSIONED),
      },
    });
    for (const executor of executors) {
      this.logger.debug(`Checking executor ${executor.id}`);
      try {
        // Get health check with status metrics
        const executorAdapter = await this.executorAdapterFactory.create(executor);
        await executorAdapter.healthCheck();

        let executorInfo: ExecutorInfo | undefined;
        try {
          executorInfo = await executorAdapter.executorInfo();
        } catch (e) {
          this.logger.warn(`Failed to get executor info for executor ${executor.id}: ${e.message}`);
        }

        await this.updateExecutorStatus(executor.id, executorInfo);

        await this.recalculateExecutorUsage(executor.id);
      } catch (e) {
        if (e.code === "ECONNREFUSED") {
          this.logger.error("Executor not reachable");
        } else {
          this.logger.error(`Error checking executor ${executor.id}: ${e.message}`);
          this.logger.error(e);
        }

        await this.updateExecutorState(executor.id, ExecutorState.UNRESPONSIVE);
      }
    }
    this.checkingExecutors = false;
  }

  private async updateExecutorStatus(executorId: string, executorInfo?: ExecutorInfo) {
    const executor = await this.executorRepository.findOne({ where: { id: executorId } });
    if (!executor) {
      this.logger.error(`Executor ${executorId} not found when trying to update status`);
      return;
    }

    if (executor.state === ExecutorState.DECOMMISSIONED) {
      this.logger.debug(`Executor ${executorId} is decommissioned, not updating status`);
      return;
    }

    const updateData: any = {
      state: ExecutorState.READY,
      lastChecked: new Date(),
    };

    const metrics = executorInfo?.metrics;

    if (metrics && typeof metrics.currentCpuUsagePercentage !== "undefined") {
      updateData.currentCpuUsagePercentage = metrics.currentCpuUsagePercentage || 0;
      updateData.currentMemoryUsagePercentage = metrics.currentMemoryUsagePercentage || 0;
      updateData.currentDiskUsagePercentage = metrics.currentDiskUsagePercentage || 0;
      updateData.currentAllocatedCpu = metrics.currentAllocatedCpu || 0;
      updateData.currentAllocatedMemoryGiB = metrics.currentAllocatedMemoryGiB || 0;
      updateData.currentAllocatedDiskGiB = metrics.currentAllocatedDiskGiB || 0;
      updateData.currentImageCount = metrics.currentImageCount || 0;
    } else {
      this.logger.warn(`Executor ${executorId} didn't send health metrics`);
    }

    await this.executorRepository.update(executorId, updateData);
  }

  async recalculateExecutorUsage(executorId: string) {
    const executor = await this.executorRepository.findOne({ where: { id: executorId } });
    if (!executor) {
      throw new Error("Executor not found");
    }
    //  recalculate executor usage
    const sandboxes = await this.sandboxRepository.find({
      where: {
        executorId: executor.id,
        state: Not(SandboxState.DESTROYED),
      },
    });
    executor.used = sandboxes.length;

    await this.executorRepository.save(executor);
  }

  private isValidClass(sandboxClass: SandboxClass): boolean {
    return Object.values(SandboxClass).includes(sandboxClass);
  }

  async updateSchedulingStatus(id: string, unschedulable: boolean): Promise<Executor> {
    const executor = await this.executorRepository.findOne({ where: { id } });
    if (!executor) {
      throw new Error("Executor not found");
    }

    executor.unschedulable = unschedulable;
    return this.executorRepository.save(executor);
  }

  async getRandomAvailableExecutor(params: GetExecutorParams): Promise<Executor> {
    const availableExecutors = await this.findAvailableExecutors(params);

    //  TODO: implement a better algorithm to get a random available executor based on the executor's usage

    if (availableExecutors.length === 0) {
      throw new BadRequestError("No available executors");
    }

    // Get random executor from available executors using inclusive bounds
    const randomIntFromInterval = (min: number, max: number) =>
      Math.floor(Math.random() * (max - min + 1) + min);

    return availableExecutors[randomIntFromInterval(0, availableExecutors.length - 1)];
  }

  async getImageExecutor(executorId, imageRef: string): Promise<ImageExecutor> {
    return this.imageExecutorRepository.findOne({
      where: {
        executorId: executorId,
        imageRef: imageRef,
      },
    });
  }

  async getImageExecutors(imageRef: string): Promise<ImageExecutor[]> {
    return this.imageExecutorRepository.find({
      where: {
        imageRef: imageRef,
      },
      order: {
        state: "ASC", // Sorts state BUILDING_SNAPSHOT before ERROR
        createdAt: "ASC", // Sorts first executor to start building image on top
      },
    });
  }

  async createImageExecutor(
    executorId: string,
    imageRef: string,
    state: ImageExecutorState,
    errorReason?: string
  ): Promise<void> {
    const imageExecutor = new ImageExecutor();
    imageExecutor.executorId = executorId;
    imageExecutor.imageRef = imageRef;
    imageExecutor.state = state;
    if (errorReason) {
      imageExecutor.errorReason = errorReason;
    }
    await this.imageExecutorRepository.save(imageExecutor);
  }

  async getExecutorsWithMultipleImagesBuilding(maxImageCount = 2): Promise<string[]> {
    const executors = await this.sandboxRepository
      .createQueryBuilder("sandbox")
      .select("sandbox.executorId")
      .where("sandbox.state = :state", { state: SandboxState.BUILDING_IMAGE })
      .andWhere("sandbox.buildInfoImageRef IS NOT NULL")
      .groupBy("sandbox.executorId")
      .having("COUNT(DISTINCT sandbox.buildInfoImageRef) > :maxImageCount", {
        maxImageCount,
      })
      .getRawMany();

    return executors.map((item) => item.executorId);
  }

  async getExecutorsByImageInternalName(internalName: string): Promise<ExecutorImageDto[]> {
    this.logger.debug(`Looking for image with internalName: ${internalName}`);

    // First find the image by internalName
    const image = await this.imageRepository.findOne({
      where: { internalName },
    });

    if (!image) {
      this.logger.debug(`No image found with internalName: ${internalName}`);
      return [];
    }

    this.logger.debug(`Found image with ID: ${image.id}`);

    // Find all image executors for this image
    // Note: imageRef contains the internalName, not the image ID
    const imageExecutors = await this.imageExecutorRepository.find({
      where: {
        imageRef: internalName,
        state: Not(ImageExecutorState.ERROR),
      },
    });

    this.logger.debug(`Found ${imageExecutors.length} image executors for image ${image.id}`);

    if (imageExecutors.length === 0) {
      this.logger.debug(`No image executors found for image ${image.id}`);
      return [];
    }

    // Get the executor IDs
    const executorIds = imageExecutors.map((sr) => sr.executorId);
    this.logger.debug(`Executor IDs found: ${executorIds.join(", ")}`);

    // Find all executors with these IDs
    const executors = await this.executorRepository.find({
      where: { id: In(executorIds) },
      select: ["id", "domain"],
    });

    this.logger.debug(
      `Found ${executors.length} executors with IDs: ${executors.map((r) => r.id).join(", ")}`
    );

    // Map to DTO format, including the image executor ID
    return executors.map((executor) => {
      const imageExecutor = imageExecutors.find((sr) => sr.executorId === executor.id);
      return new ExecutorImageDto(imageExecutor.id, executor.id, executor.domain);
    });
  }
}

export class GetExecutorParams {
  region?: string;
  sandboxClass?: SandboxClass;
  imageRef?: string;
  excludedExecutorIds?: string[];
}

interface AvailabilityScoreParams {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  allocatedCpu: number;
  allocatedMemoryGiB: number;
  allocatedDiskGiB: number;
  capacity: number;
  executorCpu: number;
  executorMemoryGiB: number;
  executorDiskGiB: number;
}
