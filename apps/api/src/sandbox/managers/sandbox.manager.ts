import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { InjectRedis } from "@nestjs-modules/ioredis";
import {
  CreateSandboxDTO,
  EnumsSandboxState as ExecutorSandboxState,
} from "@snapflow/executor-api-client";
import { Redis } from "ioredis";
import { In, Not, Raw, Repository } from "typeorm";
import { fromAxiosError } from "../../common/utils/axios-error";
import { RegistryService } from "../../registry/registry.service";
import { RedisLockProvider } from "../common/redis-lock.provider";
import { SANDBOX_WARM_POOL_UNASSIGNED_ORGANIZATION } from "../constants/sandbox.constants";
import { SandboxEvents } from "../constants/sandbox-events.constants";
import { DockerProvider } from "../docker/docker-provider";
import { BuildInfo } from "../entities/build-info.entity";
import { Executor } from "../entities/executor.entity";
import { ImageExecutor } from "../entities/image-executor.entity";
import { Sandbox } from "../entities/sandbox.entity";
import { BackupState } from "../enums/backup-state.enum";
import { ExecutorState } from "../enums/executor-state.enum";
import { ImageExecutorState } from "../enums/image-executor-state.enum";
import { SandboxDesiredState } from "../enums/sandbox-desired-state.enum";
import { SandboxState } from "../enums/sandbox-state.enum";
import { SandboxArchivedEvent } from "../events/sandbox-archived.event";
import { SandboxCreatedEvent } from "../events/sandbox-create.event";
import { SandboxDestroyedEvent } from "../events/sandbox-destroyed.event";
import { SandboxStartedEvent } from "../events/sandbox-started.event";
import { SandboxStoppedEvent } from "../events/sandbox-stopped.event";
import { ExecutorApiFactory } from "../executor-api/executor-api";
import { ExecutorService } from "../services/executor.service";
import { ImageService } from "../services/image.service";

const SYNC_INSTANCE_STATE_LOCK_KEY = "sync-instance-state-";
const SYNC_AGAIN = "sync-again";
const DONT_SYNC_AGAIN = "dont-sync-again";
type SyncState = typeof SYNC_AGAIN | typeof DONT_SYNC_AGAIN;

@Injectable()
export class SandboxManager {
  private readonly logger = new Logger(SandboxManager.name);

  constructor(
    @InjectRepository(Sandbox)
    private readonly sandboxRepository: Repository<Sandbox>,
    @InjectRepository(ImageExecutor)
    private readonly imageExecutorRepository: Repository<ImageExecutor>,
    private readonly executorService: ExecutorService,
    private readonly executorApiFactory: ExecutorApiFactory,
    private readonly registryService: RegistryService,
    @InjectRedis() private readonly redis: Redis,
    private readonly imageService: ImageService,
    private readonly redisLockProvider: RedisLockProvider,
    private readonly dockerProvider: DockerProvider
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: "auto-stop-check" })
  async autostopCheck(): Promise<void> {
    //  lock the sync to only run one instance at a time
    //  keep the worker selected for 1 minute
    if (!(await this.redisLockProvider.lock("auto-stop-check-worker-selected", 60))) {
      return;
    }

    // Get all ready executors
    const allExecutors = await this.executorService.findAll();
    const readyExecutors = allExecutors.filter(
      (executor) => executor.state === ExecutorState.READY
    );

    // Process all executors in parallel
    await Promise.all(
      readyExecutors.map(async (executor) => {
        const sandboxs = await this.sandboxRepository.find({
          where: {
            executorId: executor.id,
            organizationId: Not(SANDBOX_WARM_POOL_UNASSIGNED_ORGANIZATION),
            state: SandboxState.STARTED,
            desiredState: SandboxDesiredState.STARTED,
            pending: Not(true),
            autoStopInterval: Not(0),
            lastActivityAt: Raw(
              (alias) => `${alias} < NOW() - INTERVAL '1 minute' * "autoStopInterval"`
            ),
          },
          order: {
            lastBackupAt: "ASC",
          },
          //  todo: increase this number when auto-stop is stable
          take: 10,
        });

        await Promise.all(
          sandboxs.map(async (sandbox) => {
            const lockKey = SYNC_INSTANCE_STATE_LOCK_KEY + sandbox.id;
            const acquired = await this.redisLockProvider.lock(lockKey, 30);
            if (!acquired) {
              return;
            }

            try {
              sandbox.pending = true;
              sandbox.desiredState = SandboxDesiredState.STOPPED;
              await this.sandboxRepository.save(sandbox);
              await this.redisLockProvider.unlock(lockKey);
              this.syncInstanceState(sandbox.id);
            } catch (error) {
              this.logger.error(
                `Error processing auto-stop state for sandbox ${sandbox.id}:`,
                fromAxiosError(error)
              );
            }
          })
        );
      })
    );
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: "auto-archive-check" })
  async autoArchiveCheck(): Promise<void> {
    //  lock the sync to only run one instance at a time
    const autoArchiveCheckWorkerSelected = await this.redis.get(
      "auto-archive-check-worker-selected"
    );
    if (autoArchiveCheckWorkerSelected) {
      return;
    }
    //  keep the worker selected for 1 minute
    await this.redis.setex("auto-archive-check-worker-selected", 60, "1");

    // Get all ready executors
    const allExecutors = await this.executorService.findAll();
    const readyExecutors = allExecutors.filter(
      (executor) => executor.state === ExecutorState.READY
    );

    // Process all executors in parallel
    await Promise.all(
      readyExecutors.map(async (executor) => {
        const sandboxs = await this.sandboxRepository.find({
          where: {
            executorId: executor.id,
            organizationId: Not(SANDBOX_WARM_POOL_UNASSIGNED_ORGANIZATION),
            state: SandboxState.STOPPED,
            desiredState: SandboxDesiredState.STOPPED,
            pending: Not(true),
            lastActivityAt: Raw(
              (alias) => `${alias} < NOW() - INTERVAL '1 minute' * "autoArchiveInterval"`
            ),
          },
          order: {
            lastBackupAt: "ASC",
          },
          //  max 3 sandboxs can be archived at the same time on the same executor
          //  this is to prevent the executor from being overloaded
          take: 3,
        });

        await Promise.all(
          sandboxs.map(async (sandbox) => {
            const lockKey = SYNC_INSTANCE_STATE_LOCK_KEY + sandbox.id;
            const acquired = await this.redisLockProvider.lock(lockKey, 30);
            if (!acquired) {
              return;
            }

            try {
              sandbox.pending = true;
              sandbox.desiredState = SandboxDesiredState.ARCHIVED;
              await this.sandboxRepository.save(sandbox);
              await this.redisLockProvider.unlock(lockKey);
              this.syncInstanceState(sandbox.id);
            } catch (error) {
              this.logger.error(
                `Error processing auto-archive state for sandbox ${sandbox.id}:`,
                fromAxiosError(error)
              );
            }
          })
        );
      })
    );
  }

  @Cron(CronExpression.EVERY_10_SECONDS, { name: "sync-states" })
  async syncStates(): Promise<void> {
    const lockKey = "sync-states";
    if (!(await this.redisLockProvider.lock(lockKey, 30))) {
      return;
    }

    const sandboxs = await this.sandboxRepository.find({
      where: {
        state: Not(In([SandboxState.DESTROYED, SandboxState.ERROR, SandboxState.BUILD_FAILED])),
        desiredState: Raw(
          () =>
            `"Sandbox"."desiredState"::text != "Sandbox"."state"::text AND "Sandbox"."desiredState"::text != 'archived'`
        ),
      },
      take: 100,
      order: {
        lastActivityAt: "DESC",
      },
    });

    await Promise.all(
      sandboxs.map(async (sandbox) => {
        this.syncInstanceState(sandbox.id);
      })
    );

    await this.redisLockProvider.unlock(lockKey);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: "sync-archived-desired-states",
  })
  async syncArchivedDesiredStates(): Promise<void> {
    const lockKey = "sync-archived-desired-states";
    if (!(await this.redisLockProvider.lock(lockKey, 30))) {
      return;
    }

    const executorsWith3InProgress = await this.sandboxRepository
      .createQueryBuilder("sandbox")
      .select('"executorId"')
      .where('"sandbox"."state" = :state', { state: SandboxState.ARCHIVING })
      .groupBy('"executorId"')
      .having("COUNT(*) >= 3")
      .getRawMany();

    const sandboxs = await this.sandboxRepository.find({
      where: [
        {
          state: SandboxState.ARCHIVING,
          desiredState: SandboxDesiredState.ARCHIVED,
        },
        {
          state: Not(
            In([
              SandboxState.ARCHIVED,
              SandboxState.DESTROYED,
              SandboxState.ERROR,
              SandboxState.BUILD_FAILED,
            ])
          ),
          desiredState: SandboxDesiredState.ARCHIVED,
          executorId: Not(In(executorsWith3InProgress.map((executor) => executor.executorId))),
        },
      ],
      take: 100,
      order: {
        lastActivityAt: "DESC",
      },
    });

    await Promise.all(
      sandboxs.map(async (sandbox) => {
        this.syncInstanceState(sandbox.id);
      })
    );
    await this.redisLockProvider.unlock(lockKey);
  }

  async syncInstanceState(sandboxId: string): Promise<void> {
    const lockKey = SYNC_INSTANCE_STATE_LOCK_KEY + sandboxId;
    const acquired = await this.redisLockProvider.lock(lockKey, 360);
    if (!acquired) {
      return;
    }

    const sandbox = await this.sandboxRepository.findOneByOrFail({
      id: sandboxId,
    });

    if (
      [SandboxState.DESTROYED, SandboxState.ERROR, SandboxState.BUILD_FAILED].includes(
        sandbox.state
      )
    ) {
      await this.redisLockProvider.unlock(lockKey);
      return;
    }

    let syncState = DONT_SYNC_AGAIN;

    try {
      switch (sandbox.desiredState) {
        case SandboxDesiredState.STARTED: {
          syncState = await this.handleSandboxDesiredStateStarted(sandbox);
          break;
        }
        case SandboxDesiredState.STOPPED: {
          syncState = await this.handleSandboxDesiredStateStopped(sandbox);
          break;
        }
        case SandboxDesiredState.DESTROYED: {
          syncState = await this.handleSandboxDesiredStateDestroyed(sandbox);
          break;
        }
        case SandboxDesiredState.ARCHIVED: {
          syncState = await this.handleSandboxDesiredStateArchived(sandbox);
          break;
        }
      }
    } catch (error) {
      if (error.code === "ECONNRESET") {
        syncState = SYNC_AGAIN;
      } else {
        const sandboxError = fromAxiosError(error);
        this.logger.error(`Error processing desired state for sandbox ${sandboxId}:`, sandboxError);

        const sandbox = await this.sandboxRepository.findOneBy({
          id: sandboxId,
        });
        if (!sandbox) {
          //  edge case where sandbox is deleted while desired state is being processed
          return;
        }
        await this.updateSandboxState(
          sandbox.id,
          SandboxState.ERROR,
          undefined,
          sandboxError.message || String(error)
        );
      }
    }

    await this.redisLockProvider.unlock(lockKey);
    if (syncState === SYNC_AGAIN) {
      this.syncInstanceState(sandboxId);
    }
  }

  private async handleUnassignedBuildSandbox(sandbox: Sandbox): Promise<SyncState> {
    // Try to assign an available executor with the image build
    let executorId: string;
    try {
      const executor = await this.executorService.getRandomAvailableExecutor({
        region: sandbox.region,
        sandboxClass: sandbox.class,
        imageRef: sandbox.buildInfo.imageRef,
      });
      executorId = executor.id;
    } catch (error) {
      // Continue to next assignment method
    }

    if (executorId) {
      await this.updateSandboxState(sandbox.id, SandboxState.UNKNOWN, executorId);
      return SYNC_AGAIN;
    }

    // Try to assign an available executor that is currently building the image
    const imageExecutors = await this.executorService.getImageExecutors(sandbox.buildInfo.imageRef);

    for (const imageExecutor of imageExecutors) {
      const executor = await this.executorService.findOne(imageExecutor.executorId);
      if (executor.used < executor.capacity) {
        if (imageExecutor.state === ImageExecutorState.BUILDING_IMAGE) {
          await this.updateSandboxState(sandbox.id, SandboxState.BUILDING_IMAGE, executor.id);
          return SYNC_AGAIN;
        }

        if (imageExecutor.state === ImageExecutorState.ERROR) {
          await this.updateSandboxState(
            sandbox.id,
            SandboxState.BUILD_FAILED,
            undefined,
            imageExecutor.errorReason
          );
          return DONT_SYNC_AGAIN;
        }
      }
    }

    const excludedExecutorIds = await this.executorService.getExecutorsWithMultipleImagesBuilding();

    // Try to assign a new available executor
    const executor = await this.executorService.getRandomAvailableExecutor({
      region: sandbox.region,
      sandboxClass: sandbox.class,
      excludedExecutorIds: excludedExecutorIds,
    });
    executorId = executor.id;

    this.buildOnExecutor(sandbox.buildInfo, executorId, sandbox.organizationId);

    await this.updateSandboxState(sandbox.id, SandboxState.BUILDING_IMAGE, executorId);
    await this.executorService.recalculateExecutorUsage(executorId);
    return SYNC_AGAIN;
  }

  // Initiates the image build on the executor and creates an ImageExecutor depending on the result
  async buildOnExecutor(buildInfo: BuildInfo, executorId: string, organizationId: string) {
    const executor = await this.executorService.findOne(executorId);
    const executorImageApi = this.executorApiFactory.createImageApi(executor);

    let retries = 0;

    while (retries < 10) {
      try {
        await executorImageApi.buildImage({
          image: buildInfo.imageRef,
          organizationId: organizationId,
          dockerfile: buildInfo.dockerfileContent,
          context: buildInfo.contextHashes,
        });
        break;
      } catch (err) {
        if (err.code !== "ECONNRESET") {
          await this.executorService.createImageExecutor(
            executorId,
            buildInfo.imageRef,
            ImageExecutorState.ERROR,
            err.message
          );
          return;
        }
      }
      retries++;
      await new Promise((resolve) => setTimeout(resolve, retries * 1000));
    }

    if (retries === 10) {
      await this.executorService.createImageExecutor(
        executorId,
        buildInfo.imageRef,
        ImageExecutorState.ERROR,
        "Timeout while building"
      );
      return;
    }

    const response = (await executorImageApi.imageExists(buildInfo.imageRef)).data;
    let state = ImageExecutorState.BUILDING_IMAGE;
    if (response?.exists) {
      state = ImageExecutorState.READY;
    }

    await this.executorService.createImageExecutor(executorId, buildInfo.imageRef, state);
  }

  private async handleSandboxDesiredStateArchived(sandbox: Sandbox): Promise<SyncState> {
    const lockKey = `archive-lock-${sandbox.executorId}`;
    if (!(await this.redisLockProvider.lock(lockKey, 10))) {
      return DONT_SYNC_AGAIN;
    }

    const inProgressOnExecutor = await this.sandboxRepository.find({
      where: {
        executorId: sandbox.executorId,
        state: In([SandboxState.ARCHIVING]),
      },
      order: {
        lastActivityAt: "DESC",
      },
      take: 100,
    });

    if (!inProgressOnExecutor.find((s) => s.id === sandbox.id)) {
      //  max 3 sandboxs can be archived at the same time on the same executor
      //  this is to prevent the executor from being overloaded
      if (inProgressOnExecutor.length > 2) {
        await this.redisLockProvider.unlock(lockKey);
        return;
      }
    }

    switch (sandbox.state) {
      // biome-ignore lint/suspicious/noFallthroughSwitchClause: its ok if this falls through
      case SandboxState.STOPPED: {
        await this.updateSandboxState(sandbox.id, SandboxState.ARCHIVING);
      }
      case SandboxState.ARCHIVING: {
        await this.redisLockProvider.unlock(lockKey);

        //  if the backup state is error, we need to retry the backup
        if (sandbox.backupState === BackupState.ERROR) {
          const archiveErrorRetryKey = `archive-error-retry-${sandbox.id}`;
          const archiveErrorRetryCountRaw = await this.redis.get(archiveErrorRetryKey);
          const archiveErrorRetryCount = archiveErrorRetryCountRaw
            ? Number.parseInt(archiveErrorRetryCountRaw)
            : 0;

          if (archiveErrorRetryCount > 3) {
            await this.updateSandboxState(
              sandbox.id,
              SandboxState.ERROR,
              undefined,
              "Failed to archive sandbox"
            );
            await this.redis.del(archiveErrorRetryKey);
            return DONT_SYNC_AGAIN;
          }
          await this.redis.setex(
            `archive-error-retry-${sandbox.id}`,
            720,
            String(archiveErrorRetryCount + 1)
          );

          //  reset the backup state to pending to retry the backup
          await this.sandboxRepository.update(sandbox.id, {
            backupState: BackupState.PENDING,
          });

          return DONT_SYNC_AGAIN;
        }

        // Check for timeout - if more than 120 minutes since last activity
        const thirtyMinutesAgo = new Date(Date.now() - 120 * 60 * 1000);
        if (sandbox.lastActivityAt < thirtyMinutesAgo) {
          await this.updateSandboxState(
            sandbox.id,
            SandboxState.ERROR,
            undefined,
            "Archiving operation timed out"
          );
          return DONT_SYNC_AGAIN;
        }

        if (sandbox.backupState !== BackupState.COMPLETED) {
          return DONT_SYNC_AGAIN;
        }

        //  when the backup is completed, destroy the sandbox on the executor
        //  and deassociate the sandbox from the executor
        const executor = await this.executorService.findOne(sandbox.executorId);
        const executorSandboxApi = this.executorApiFactory.createSandboxApi(executor);

        try {
          const sandboxInfoResponse = await executorSandboxApi.info(sandbox.id);
          const sandboxInfo = sandboxInfoResponse.data;
          switch (sandboxInfo.state) {
            case ExecutorSandboxState.SandboxStateDestroying:
              //  wait until sandbox is destroyed on executor
              return SYNC_AGAIN;
            case ExecutorSandboxState.SandboxStateDestroyed:
              await this.updateSandboxState(sandbox.id, SandboxState.ARCHIVED, null);
              return DONT_SYNC_AGAIN;
            default:
              await executorSandboxApi.destroy(sandbox.id);
              return SYNC_AGAIN;
          }
        } catch (error) {
          //  fail for errors other than sandbox not found or sandbox already destroyed
          if (
            !(
              (error.response?.data?.statusCode === 400 &&
                error.response?.data?.message.includes("Sandbox already destroyed")) ||
              error.response?.status === 404
            )
          ) {
            throw error;
          }
          //  if the sandbox is already destroyed, do nothing
          await this.updateSandboxState(sandbox.id, SandboxState.ARCHIVED, null);
          return DONT_SYNC_AGAIN;
        }
      }
    }

    return DONT_SYNC_AGAIN;
  }

  private async handleSandboxDesiredStateDestroyed(sandbox: Sandbox): Promise<SyncState> {
    if (sandbox.state === SandboxState.ARCHIVED) {
      await this.updateSandboxState(sandbox.id, SandboxState.DESTROYED);
      return DONT_SYNC_AGAIN;
    }

    const executor = await this.executorService.findOne(sandbox.executorId);
    if (executor.state !== ExecutorState.READY) {
      //  console.debug(`Executor ${executor.id} is not ready`);
      return DONT_SYNC_AGAIN;
    }

    switch (sandbox.state) {
      case SandboxState.DESTROYED:
        return DONT_SYNC_AGAIN;
      case SandboxState.DESTROYING: {
        // check if sandbox is destroyed
        const executorSandboxApi = this.executorApiFactory.createSandboxApi(executor);

        try {
          const sandboxInfoResponse = await executorSandboxApi.info(sandbox.id);
          const sandboxInfo = sandboxInfoResponse.data;
          if (
            sandboxInfo.state === ExecutorSandboxState.SandboxStateDestroyed ||
            sandboxInfo.state === ExecutorSandboxState.SandboxStateError
          ) {
            await executorSandboxApi.removeDestroyed(sandbox.id);
          }
        } catch (e) {
          //  if the sandbox is not found on executor, it is already destroyed
          if (!e.response || e.response.status !== 404) {
            throw e;
          }
        }

        await this.updateSandboxState(sandbox.id, SandboxState.DESTROYED);
        return SYNC_AGAIN;
      }
      default: {
        // destroy sandbox
        try {
          const executorSandboxApi = this.executorApiFactory.createSandboxApi(executor);
          const sandboxInfoResponse = await executorSandboxApi.info(sandbox.id);
          const sandboxInfo = sandboxInfoResponse.data;
          if (sandboxInfo?.state === ExecutorSandboxState.SandboxStateDestroyed) {
            await this.updateSandboxState(sandbox.id, SandboxState.DESTROYING);
            return SYNC_AGAIN;
          }
          await executorSandboxApi.destroy(sandbox.id);
        } catch (e) {
          //  if the sandbox is not found on executor, it is already destroyed
          if (e.response.status !== 404) {
            throw e;
          }
        }
        await this.updateSandboxState(sandbox.id, SandboxState.DESTROYING);
        return SYNC_AGAIN;
      }
    }
  }

  private async handleSandboxDesiredStateStarted(sandbox: Sandbox): Promise<SyncState> {
    switch (sandbox.state) {
      case SandboxState.PENDING_BUILD: {
        return this.handleUnassignedBuildSandbox(sandbox);
      }
      case SandboxState.BUILDING_IMAGE: {
        return this.handleExecutorSandboxBuildingImageStateOnDesiredStateStart(sandbox);
      }
      case SandboxState.UNKNOWN: {
        return this.handleExecutorSandboxUnknownStateOnDesiredStateStart(sandbox);
      }
      case SandboxState.ARCHIVED:
      case SandboxState.STOPPED: {
        return this.handleExecutorSandboxStoppedOrArchivedStateOnDesiredStateStart(sandbox);
      }
      case SandboxState.RESTORING:
      case SandboxState.CREATING: {
        return this.handleExecutorSandboxPullingImageStateCheck(sandbox);
      }
      case SandboxState.PULLING_IMAGE:
      case SandboxState.STARTING: {
        return this.handleExecutorSandboxStartedStateCheck(sandbox);
      }
      //  TODO: remove this case
      case SandboxState.ERROR: {
        //  TODO: remove this asap
        //  this was a temporary solution to recover from the false positive error state
        if (sandbox.id.startsWith("err_")) {
          return DONT_SYNC_AGAIN;
        }
        const executor = await this.executorService.findOne(sandbox.executorId);
        const executorSandboxApi = this.executorApiFactory.createSandboxApi(executor);
        const sandboxInfoResponse = await executorSandboxApi.info(sandbox.id);
        const sandboxInfo = sandboxInfoResponse.data;
        if (sandboxInfo.state === ExecutorSandboxState.SandboxStateStarted) {
          const sandboxToUpdate = await this.sandboxRepository.findOneByOrFail({
            id: sandbox.id,
          });
          sandboxToUpdate.state = SandboxState.STARTED;
          sandboxToUpdate.backupState = BackupState.NONE;
          try {
            const nodeVersion = await this.getSandboxDaemonVersion(sandbox, executor);
            sandboxToUpdate.nodeVersion = nodeVersion;
          } catch (e) {
            this.logger.error(`Failed to get sandbox node version for sandbox ${sandbox.id}:`, e);
          }
          await this.sandboxRepository.save(sandboxToUpdate);
        }
      }
    }

    return DONT_SYNC_AGAIN;
  }

  private async handleSandboxDesiredStateStopped(sandbox: Sandbox): Promise<SyncState> {
    const executor = await this.executorService.findOne(sandbox.executorId);
    if (executor.state !== ExecutorState.READY) {
      //  console.debug(`Executor ${executor.id} is not ready`);
      return DONT_SYNC_AGAIN;
    }

    switch (sandbox.state) {
      case SandboxState.STARTED: {
        // stop sandbox
        const executorSandboxApi = this.executorApiFactory.createSandboxApi(executor);
        await executorSandboxApi.stop(sandbox.id);
        await this.updateSandboxState(sandbox.id, SandboxState.STOPPING);
        //  sync states again immediately for sandbox
        return SYNC_AGAIN;
      }
      case SandboxState.STOPPING: {
        // check if sandbox is stopped
        const executor = await this.executorService.findOne(sandbox.executorId);
        const executorSandboxApi = this.executorApiFactory.createSandboxApi(executor);
        const sandboxInfoResponse = await executorSandboxApi.info(sandbox.id);
        const sandboxInfo = sandboxInfoResponse.data;
        switch (sandboxInfo.state) {
          case ExecutorSandboxState.SandboxStateStopped: {
            const sandboxToUpdate = await this.sandboxRepository.findOneByOrFail({
              id: sandbox.id,
            });
            sandboxToUpdate.state = SandboxState.STOPPED;
            sandboxToUpdate.backupState = BackupState.NONE;
            await this.sandboxRepository.save(sandboxToUpdate);
            return SYNC_AGAIN;
          }
          case ExecutorSandboxState.SandboxStateError: {
            await this.updateSandboxState(
              sandbox.id,
              SandboxState.ERROR,
              undefined,
              "Sandbox is in error state on executor"
            );
            return DONT_SYNC_AGAIN;
          }
        }
        return SYNC_AGAIN;
      }
      case SandboxState.ERROR: {
        if (sandbox.id.startsWith("err_")) {
          return DONT_SYNC_AGAIN;
        }
        const executor = await this.executorService.findOne(sandbox.executorId);
        const executorSandboxApi = this.executorApiFactory.createSandboxApi(executor);
        const sandboxInfoResponse = await executorSandboxApi.info(sandbox.id);
        const sandboxInfo = sandboxInfoResponse.data;
        if (sandboxInfo.state === ExecutorSandboxState.SandboxStateStopped) {
          await this.updateSandboxState(sandbox.id, SandboxState.STOPPED);
        }
      }
    }

    return DONT_SYNC_AGAIN;
  }

  private async handleExecutorSandboxBuildingImageStateOnDesiredStateStart(
    sandbox: Sandbox
  ): Promise<SyncState> {
    const imageExecutor = await this.executorService.getImageExecutor(
      sandbox.executorId,
      sandbox.buildInfo.imageRef
    );
    if (imageExecutor) {
      switch (imageExecutor.state) {
        case ImageExecutorState.READY: {
          // TODO: "UNKNOWN" should probably be changed to something else
          await this.updateSandboxState(sandbox.id, SandboxState.UNKNOWN);
          return SYNC_AGAIN;
        }
        case ImageExecutorState.ERROR: {
          await this.updateSandboxState(
            sandbox.id,
            SandboxState.BUILD_FAILED,
            undefined,
            imageExecutor.errorReason
          );
          return DONT_SYNC_AGAIN;
        }
      }
    }
    if (!imageExecutor || imageExecutor.state === ImageExecutorState.BUILDING_IMAGE) {
      // Sleep for a second and go back to syncing instance state
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return SYNC_AGAIN;
    }

    return DONT_SYNC_AGAIN;
  }

  private async handleExecutorSandboxUnknownStateOnDesiredStateStart(
    sandbox: Sandbox
  ): Promise<SyncState> {
    const executor = await this.executorService.findOne(sandbox.executorId);
    if (executor.state !== ExecutorState.READY) {
      //  console.debug(`Executor ${executor.id} is not ready`);
      return DONT_SYNC_AGAIN;
    }

    let createSandboxDto: CreateSandboxDTO = {
      id: sandbox.id,
      osUser: sandbox.osUser,
      image: "",
      // TODO: organizationId: sandbox.organizationId,
      userId: sandbox.organizationId,
      storageQuota: sandbox.disk,
      memoryQuota: sandbox.mem,
      cpuQuota: sandbox.cpu,
      // gpuQuota: sandbox.gpu,
      env: sandbox.env,
      // public: sandbox.public,
      buckets: sandbox.buckets,
    };

    if (!sandbox.buildInfo) {
      //  get internal image name
      const image = await this.imageService.getImageByName(sandbox.image, sandbox.organizationId);
      const internalImageName = image.internalName;

      const registry = await this.registryService.findOneByImageImageName(
        internalImageName,
        sandbox.organizationId
      );
      if (!registry) {
        throw new Error("No registry found for image");
      }

      createSandboxDto = {
        ...createSandboxDto,
        image: internalImageName,
        entrypoint: image.entrypoint,
        registry: {
          url: registry.url,
          username: registry.username,
          password: registry.password,
        },
      };
    } else {
      createSandboxDto = {
        ...createSandboxDto,
        image: sandbox.buildInfo.imageRef,
        entrypoint: this.getEntrypointFromDockerfile(sandbox.buildInfo.dockerfileContent),
      };
    }

    const executorSandboxApi = this.executorApiFactory.createSandboxApi(executor);
    await executorSandboxApi.create(createSandboxDto);
    await this.updateSandboxState(sandbox.id, SandboxState.CREATING);
    //  sync states again immediately for sandbox
    return SYNC_AGAIN;
  }

  // TODO: revise/cleanup
  private getEntrypointFromDockerfile(dockerfileContent: string): string[] {
    // Match ENTRYPOINT with either a string or JSON array
    const entrypointMatch = dockerfileContent.match(/ENTRYPOINT\s+(.*)/);
    if (entrypointMatch) {
      const rawEntrypoint = entrypointMatch[1].trim();
      try {
        // Try parsing as JSON array
        const parsed = JSON.parse(rawEntrypoint);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // Fallback: it's probably a plain string
        return [rawEntrypoint.replace(/["']/g, "")];
      }
    }

    // Match CMD with either a string or JSON array
    const cmdMatch = dockerfileContent.match(/CMD\s+(.*)/);
    if (cmdMatch) {
      const rawCmd = cmdMatch[1].trim();
      try {
        const parsed = JSON.parse(rawCmd);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        return [rawCmd.replace(/["']/g, "")];
      }
    }

    return ["sleep", "infinity"];
  }

  private async handleExecutorSandboxStoppedOrArchivedStateOnDesiredStateStart(
    sandbox: Sandbox
  ): Promise<SyncState> {
    //  check if sandbox is assigned to a executor and if that executor is unschedulable
    //  if it is, move sandbox to prevExecutorId, and set executorId to null
    //  this will assign a new executor to the sandbox and restore the sandbox from the latest backup
    if (sandbox.executorId) {
      const executor = await this.executorService.findOne(sandbox.executorId);
      if (executor.unschedulable) {
        //  check if sandbox has a valid backup
        if (sandbox.backupState !== BackupState.COMPLETED) {
          //  if not, keep sandbox on the same executor
        } else {
          sandbox.prevExecutorId = sandbox.executorId;
          sandbox.executorId = null;

          const sandboxToUpdate = await this.sandboxRepository.findOneByOrFail({
            id: sandbox.id,
          });
          sandboxToUpdate.prevExecutorId = sandbox.executorId;
          sandboxToUpdate.executorId = null;
          await this.sandboxRepository.save(sandboxToUpdate);
        }
      }

      if (sandbox.backupState === BackupState.COMPLETED) {
        const usageThreshold = 35;
        const runningSandboxsCount = await this.sandboxRepository.count({
          where: {
            executorId: sandbox.executorId,
            state: SandboxState.STARTED,
          },
        });
        if (runningSandboxsCount > usageThreshold) {
          //  TODO: usage should be based on compute usage

          const availableExecutors = await this.executorService.findAvailableExecutors({
            region: sandbox.region,
            sandboxClass: sandbox.class,
          });
          const lessUsedExecutors = availableExecutors.filter(
            (executor) => executor.id !== sandbox.executorId
          );

          //  temp workaround to move sandboxs to less used executor
          if (lessUsedExecutors.length > 0) {
            await this.sandboxRepository.update(sandbox.id, {
              executorId: null,
              prevExecutorId: sandbox.executorId,
            });
            try {
              const executorSandboxApi = this.executorApiFactory.createSandboxApi(executor);
              await executorSandboxApi.removeDestroyed(sandbox.id);
            } catch (e) {
              this.logger.error(
                `Failed to cleanup sandbox ${sandbox.id} on previous executor ${executor.id}:`,
                fromAxiosError(e)
              );
            }
            sandbox.prevExecutorId = sandbox.executorId;
            sandbox.executorId = null;
          }
        }
      }
    }

    if (sandbox.executorId === null) {
      //  if sandbox has no executor, check if backup is completed
      //  if not, set sandbox to error
      //  if backup is completed, get random available executor and start sandbox
      //  use the backup to start the sandbox

      if (sandbox.backupState !== BackupState.COMPLETED) {
        await this.updateSandboxState(
          sandbox.id,
          SandboxState.ERROR,
          undefined,
          "Sandbox has no executor and backup is not completed"
        );
        return DONT_SYNC_AGAIN;
      }

      const registry = await this.registryService.findOne(sandbox.backupRegistryId);
      if (!registry) {
        throw new Error("No registry found for backup");
      }

      const existingBackups = sandbox.existingBackupImages.map(
        (existingImage) => existingImage.imageName
      );
      let validBackup;
      let exists = false;

      while (existingBackups.length > 0) {
        try {
          if (!validBackup) {
            //  last image is the current image, so we don't need to check it
            //  just in case, we'll use the value from the backupImage property
            validBackup = sandbox.backupImage;
            existingBackups.pop();
          } else {
            validBackup = existingBackups.pop();
          }
          if (await this.dockerProvider.checkImageExistsInRegistry(validBackup, registry)) {
            exists = true;
            break;
          }
        } catch (error) {
          this.logger.error(
            `Failed to check if backup image ${sandbox.backupImage} exists in registry ${registry.id}:`,
            fromAxiosError(error)
          );
        }
      }

      if (!exists) {
        await this.updateSandboxState(
          sandbox.id,
          SandboxState.ERROR,
          undefined,
          "No valid backup image found"
        );
        return SYNC_AGAIN;
      }

      //  exclude the executor that the last executor sandbox was on
      const availableExecutors = (
        await this.executorService.findAvailableExecutors({
          region: sandbox.region,
          sandboxClass: sandbox.class,
        })
      ).filter((executor) => executor.id !== sandbox.prevExecutorId);

      //  get random executor from available executors
      const randomExecutorIndex = (min: number, max: number) =>
        Math.floor(Math.random() * (max - min + 1) + min);
      const executorId =
        availableExecutors[randomExecutorIndex(0, availableExecutors.length - 1)].id;

      const executor = await this.executorService.findOne(executorId);

      const executorSandboxApi = this.executorApiFactory.createSandboxApi(executor);

      await this.updateSandboxState(sandbox.id, SandboxState.RESTORING, executorId);

      await executorSandboxApi.create({
        id: sandbox.id,
        image: validBackup,
        osUser: sandbox.osUser,
        // TODO: organizationId: sandbox.organizationId,
        userId: sandbox.organizationId,
        storageQuota: sandbox.disk,
        memoryQuota: sandbox.mem,
        cpuQuota: sandbox.cpu,
        // gpuQuota: sandbox.gpu,
        env: sandbox.env,
        // public: sandbox.public,
        registry: {
          url: registry.url,
          username: registry.username,
          password: registry.password,
        },
      });
    } else {
      // if sandbox has executor, start sandbox
      const executor = await this.executorService.findOne(sandbox.executorId);

      const executorSandboxApi = this.executorApiFactory.createSandboxApi(executor);

      await executorSandboxApi.start(sandbox.id);

      await this.updateSandboxState(sandbox.id, SandboxState.STARTING);
      return SYNC_AGAIN;
    }

    return SYNC_AGAIN;
  }

  //  used to check if sandbox is pulling image on executor and update sandbox state accordingly
  private async handleExecutorSandboxPullingImageStateCheck(sandbox: Sandbox): Promise<SyncState> {
    //  edge case when sandbox is being transferred to a new executor
    if (!sandbox.executorId) {
      return SYNC_AGAIN;
    }

    const executor = await this.executorService.findOne(sandbox.executorId);
    const executorSandboxApi = this.executorApiFactory.createSandboxApi(executor);
    const sandboxInfoResponse = await executorSandboxApi.info(sandbox.id);
    const sandboxInfo = sandboxInfoResponse.data;

    if (sandboxInfo.state === ExecutorSandboxState.SandboxStatePullingImage) {
      await this.updateSandboxState(sandbox.id, SandboxState.PULLING_IMAGE);
    } else if (sandboxInfo.state === ExecutorSandboxState.SandboxStateError) {
      await this.updateSandboxState(sandbox.id, SandboxState.ERROR);
    } else {
      await this.updateSandboxState(sandbox.id, SandboxState.STARTING);
    }

    return SYNC_AGAIN;
  }

  //  used to check if sandbox is started on executor and update sandbox state accordingly
  //  also used to handle the case where a sandbox is started on a executor and then transferred to a new executor
  private async handleExecutorSandboxStartedStateCheck(sandbox: Sandbox): Promise<SyncState> {
    const executor = await this.executorService.findOne(sandbox.executorId);
    const executorSandboxApi = this.executorApiFactory.createSandboxApi(executor);
    const sandboxInfoResponse = await executorSandboxApi.info(sandbox.id);
    const sandboxInfo = sandboxInfoResponse.data;

    switch (sandboxInfo.state) {
      case ExecutorSandboxState.SandboxStateStarted: {
        let nodeVersion: string | undefined;
        try {
          nodeVersion = await this.getSandboxDaemonVersion(sandbox, executor);
        } catch (e) {
          this.logger.error(`Failed to get sandbox node version for sandbox ${sandbox.id}:`, e);
        }
        //  if previous backup state is error or completed, set backup state to none
        if ([BackupState.ERROR, BackupState.COMPLETED].includes(sandbox.backupState)) {
          sandbox.backupState = BackupState.NONE;

          const sandboxToUpdate = await this.sandboxRepository.findOneByOrFail({
            id: sandbox.id,
          });
          sandboxToUpdate.state = SandboxState.STARTED;
          sandboxToUpdate.backupState = BackupState.NONE;
          if (nodeVersion) {
            sandboxToUpdate.nodeVersion = nodeVersion;
          }
          await this.sandboxRepository.save(sandboxToUpdate);
        } else {
          await this.updateSandboxState(
            sandbox.id,
            SandboxState.STARTED,
            undefined,
            undefined,
            nodeVersion
          );
        }

        //  if sandbox was transferred to a new executor, remove it from the old executor
        if (sandbox.prevExecutorId) {
          const executor = await this.executorService.findOne(sandbox.prevExecutorId);
          if (!executor) {
            this.logger.warn(
              `Previously assigned executor ${sandbox.prevExecutorId} for sandbox ${sandbox.id} not found`
            );
            //  clear prevExecutorId to avoid trying to cleanup on a non-existent executor
            sandbox.prevExecutorId = null;

            const sandboxToUpdate = await this.sandboxRepository.findOneByOrFail({
              id: sandbox.id,
            });
            sandboxToUpdate.prevExecutorId = null;
            await this.sandboxRepository.save(sandboxToUpdate);
            break;
          }
          const executorSandboxApi = this.executorApiFactory.createSandboxApi(executor);
          try {
            // First try to destroy the sandbox
            await executorSandboxApi.destroy(sandbox.id);

            // Wait for sandbox to be destroyed before removing
            let retries = 0;
            while (retries < 10) {
              try {
                const sandboxInfo = await executorSandboxApi.info(sandbox.id);
                if (sandboxInfo.data.state === ExecutorSandboxState.SandboxStateDestroyed) {
                  break;
                }
              } catch (e) {
                if (e.response?.status === 404) {
                  break; // Sandbox already gone
                }
                throw e;
              }
              await new Promise((resolve) => setTimeout(resolve, 1000 * retries));
              retries++;
            }

            // Finally remove the destroyed sandbox
            await executorSandboxApi.removeDestroyed(sandbox.id);
            sandbox.prevExecutorId = null;

            const sandboxToUpdate = await this.sandboxRepository.findOneByOrFail({
              id: sandbox.id,
            });
            sandboxToUpdate.prevExecutorId = null;
            await this.sandboxRepository.save(sandboxToUpdate);
          } catch (e) {
            this.logger.error(
              `Failed to cleanup sandbox ${sandbox.id} on previous executor ${executor.id}:`,
              fromAxiosError(e)
            );
          }
        }
        break;
      }
      case ExecutorSandboxState.SandboxStateError: {
        await this.updateSandboxState(sandbox.id, SandboxState.ERROR);
        break;
      }
    }

    return SYNC_AGAIN;
  }

  private async updateSandboxState(
    sandboxId: string,
    state: SandboxState,
    executorId?: string | null | undefined,
    errorReason?: string,
    nodeVersion?: string
  ) {
    const sandbox = await this.sandboxRepository.findOneByOrFail({
      id: sandboxId,
    });
    if (
      sandbox.state === state &&
      sandbox.executorId === executorId &&
      sandbox.errorReason === errorReason
    ) {
      return;
    }
    sandbox.state = state;
    if (executorId !== undefined) {
      sandbox.executorId = executorId;
    }
    if (errorReason !== undefined) {
      sandbox.errorReason = errorReason;
    }
    if (nodeVersion !== undefined) {
      sandbox.nodeVersion = nodeVersion;
    }
    await this.sandboxRepository.save(sandbox);
  }

  private async getSandboxDaemonVersion(sandbox: Sandbox, executor: Executor): Promise<string> {
    const executorSandboxApi = this.executorApiFactory.createToolboxApi(executor);
    const getVersionResponse = await executorSandboxApi.sandboxesSandboxIdToolboxPathGet(
      sandbox.id,
      "version"
    );
    if (!getVersionResponse.data || !(getVersionResponse.data as any).version) {
      throw new Error("Failed to get sandbox node version");
    }

    return (getVersionResponse.data as any).version;
  }

  @OnEvent(SandboxEvents.ARCHIVED)
  private async handleSandboxArchivedEvent(event: SandboxArchivedEvent) {
    this.syncInstanceState(event.sandbox.id).catch(this.logger.error);
  }

  @OnEvent(SandboxEvents.DESTROYED)
  private async handleSandboxDestroyedEvent(event: SandboxDestroyedEvent) {
    this.syncInstanceState(event.sandbox.id).catch(this.logger.error);
  }

  @OnEvent(SandboxEvents.STARTED)
  private async handleSandboxStartedEvent(event: SandboxStartedEvent) {
    this.syncInstanceState(event.sandbox.id).catch(this.logger.error);
  }

  @OnEvent(SandboxEvents.STOPPED)
  private async handleSandboxStoppedEvent(event: SandboxStoppedEvent) {
    this.syncInstanceState(event.sandbox.id).catch(this.logger.error);
  }

  @OnEvent(SandboxEvents.CREATED)
  private async handleSandboxCreatedEvent(event: SandboxCreatedEvent) {
    this.syncInstanceState(event.sandbox.id).catch(this.logger.error);
  }
}
