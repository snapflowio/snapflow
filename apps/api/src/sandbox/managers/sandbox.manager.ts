import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Not, Raw, Repository } from "typeorm";
import { RedisLockProvider } from "../common/redis-lock.provider";
import { SANDBOX_WARM_POOL_UNASSIGNED_ORGANIZATION } from "../constants/sandbox.constants";
import { SandboxEvents } from "../constants/sandbox-events.constants";
import { Sandbox } from "../entities/sandbox.entity";
import { ExecutorState } from "../enums/executor-state.enum";
import { SandboxDesiredState } from "../enums/sandbox-desired-state.enum";
import { SandboxState } from "../enums/sandbox-state.enum";
import { SandboxArchivedEvent } from "../events/sandbox-archived.event";
import { SandboxCreatedEvent } from "../events/sandbox-create.event";
import { SandboxDestroyedEvent } from "../events/sandbox-destroyed.event";
import { SandboxStartedEvent } from "../events/sandbox-started.event";
import { SandboxStoppedEvent } from "../events/sandbox-stopped.event";
import { ExecutorService } from "../services/executor.service";
import { DONT_SYNC_AGAIN, SYNC_AGAIN } from "./actions/sandbox.action";
import { SandboxArchiveAction } from "./actions/sandbox-archive.action";
import { SandboxDestroyAction } from "./actions/sandbox-destroy.action";
import { SandboxStartAction } from "./actions/sandbox-start.action";
import { SandboxStopAction } from "./actions/sandbox-stop.action";

export const SYNC_INSTANCE_STATE_LOCK_KEY = "sync-instance-state-";

@Injectable()
export class SandboxManager {
  private readonly logger = new Logger(SandboxManager.name);

  constructor(
    @InjectRepository(Sandbox)
    private readonly sandboxRepository: Repository<Sandbox>,
    private readonly executorService: ExecutorService,
    private readonly redisLockProvider: RedisLockProvider,
    private readonly sandboxStartAction: SandboxStartAction,
    private readonly sandboxStopAction: SandboxStopAction,
    private readonly sandboxDestroyAction: SandboxDestroyAction,
    private readonly sandboxArchiveAction: SandboxArchiveAction
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: "auto-stop-check" })
  async autostopCheck(): Promise<void> {
    const lockKey = "auto-stop-check-worker-selected";
    //  lock the sync to only run one instance at a time
    if (!(await this.redisLockProvider.lock(lockKey, 60))) {
      return;
    }

    try {
      // Get all ready executors
      const allExecutors = await this.executorService.findAll();
      const readyExecutors = allExecutors.filter(
        (executor) => executor.state === ExecutorState.READY
      );

      // Process all executors in parallel
      await Promise.all(
        readyExecutors.map(async (executor) => {
          const sandboxes = await this.sandboxRepository.find({
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
            sandboxes.map(async (sandbox) => {
              const lockKey = SYNC_INSTANCE_STATE_LOCK_KEY + sandbox.id;
              const acquired = await this.redisLockProvider.lock(lockKey, 30);
              if (!acquired) {
                return;
              }

              try {
                sandbox.pending = true;
                sandbox.desiredState = SandboxDesiredState.STOPPED;

                await this.sandboxRepository.save(sandbox);
                this.syncInstanceState(sandbox.id);
              } catch (error) {
                this.logger.error(
                  `Error processing auto-stop state for sandbox ${sandbox.id}:`,
                  error
                );
              } finally {
                await this.redisLockProvider.unlock(lockKey);
              }
            })
          );
        })
      );
    } finally {
      await this.redisLockProvider.unlock(lockKey);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: "auto-archive-check" })
  async autoArchiveCheck(): Promise<void> {
    const lockKey = "auto-archive-check-worker-selected";
    //  lock the sync to only run one instance at a time
    if (!(await this.redisLockProvider.lock(lockKey, 60))) {
      return;
    }

    try {
      // Get all ready executors
      const allExecutors = await this.executorService.findAll();
      const readyExecutors = allExecutors.filter(
        (executor) => executor.state === ExecutorState.READY
      );

      // Process all executors in parallel
      await Promise.all(
        readyExecutors.map(async (executor) => {
          const sandboxes = await this.sandboxRepository.find({
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
            //  max 3 sandboxes can be archived at the same time on the same executor
            //  this is to prevent the executor from being overloaded
            take: 3,
          });

          await Promise.all(
            sandboxes.map(async (sandbox) => {
              const lockKey = SYNC_INSTANCE_STATE_LOCK_KEY + sandbox.id;
              const acquired = await this.redisLockProvider.lock(lockKey, 30);
              if (!acquired) {
                return;
              }

              try {
                sandbox.pending = true;
                sandbox.desiredState = SandboxDesiredState.ARCHIVED;
                await this.sandboxRepository.save(sandbox);
                this.syncInstanceState(sandbox.id);
              } catch (error) {
                this.logger.error(
                  `Error processing auto-archive state for sandbox ${sandbox.id}:`,
                  error
                );
              } finally {
                await this.redisLockProvider.unlock(lockKey);
              }
            })
          );
        })
      );
    } finally {
      await this.redisLockProvider.unlock(lockKey);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: "auto-delete-check" })
  async autoDeleteCheck(): Promise<void> {
    const lockKey = "auto-delete-check-worker-selected";
    //  lock the sync to only run one instance at a time
    if (!(await this.redisLockProvider.lock(lockKey, 60))) {
      return;
    }

    try {
      // Get all ready executors
      const allExecutors = await this.executorService.findAll();
      const readyExecutors = allExecutors.filter(
        (executor) => executor.state === ExecutorState.READY
      );

      // Process all executors in parallel
      await Promise.all(
        readyExecutors.map(async (executor) => {
          const sandboxes = await this.sandboxRepository.find({
            where: {
              executorId: executor.id,
              organizationId: Not(SANDBOX_WARM_POOL_UNASSIGNED_ORGANIZATION),
              state: SandboxState.STOPPED,
              desiredState: SandboxDesiredState.STOPPED,
              pending: Not(true),
              lastActivityAt: Raw(
                (alias) => `${alias} < NOW() - INTERVAL '1 minute' * "autoDeleteInterval"`
              ),
            },
            order: {
              lastActivityAt: "ASC",
            },
            take: 100,
          });

          await Promise.all(
            sandboxes.map(async (sandbox) => {
              const lockKey = SYNC_INSTANCE_STATE_LOCK_KEY + sandbox.id;
              const acquired = await this.redisLockProvider.lock(lockKey, 30);
              if (!acquired) {
                return;
              }

              try {
                sandbox.pending = true;
                sandbox.desiredState = SandboxDesiredState.DESTROYED;
                await this.sandboxRepository.save(sandbox);
                this.syncInstanceState(sandbox.id);
              } catch (error) {
                this.logger.error(
                  `Error processing auto-delete state for sandbox ${sandbox.id}:`,
                  error
                );
              } finally {
                await this.redisLockProvider.unlock(lockKey);
              }
            })
          );
        })
      );
    } finally {
      await this.redisLockProvider.unlock(lockKey);
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS, { name: "sync-states" })
  async syncStates(): Promise<void> {
    const lockKey = "sync-states";
    if (!(await this.redisLockProvider.lock(lockKey, 30))) {
      return;
    }

    const sandboxes = await this.sandboxRepository.find({
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
      sandboxes.map(async (sandbox) => {
        this.syncInstanceState(sandbox.id);
      })
    );
    await this.redisLockProvider.unlock(lockKey);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, { name: "sync-archived-desired-states" })
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

    const sandboxes = await this.sandboxRepository.find({
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
      sandboxes.map(async (sandbox) => {
        this.syncInstanceState(sandbox.id);
      })
    );
    await this.redisLockProvider.unlock(lockKey);
  }

  async syncInstanceState(sandboxId: string): Promise<void> {
    //  prevent syncState cron from running multiple instances of the same sandbox
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
          syncState = await this.sandboxStartAction.run(sandbox);
          break;
        }
        case SandboxDesiredState.STOPPED: {
          syncState = await this.sandboxStopAction.run(sandbox);
          break;
        }
        case SandboxDesiredState.DESTROYED: {
          syncState = await this.sandboxDestroyAction.run(sandbox);
          break;
        }
        case SandboxDesiredState.ARCHIVED: {
          syncState = await this.sandboxArchiveAction.run(sandbox);
          break;
        }
      }
    } catch (error) {
      this.logger.error(`Error processing desired state for sandbox ${sandboxId}:`, error);

      const sandbox = await this.sandboxRepository.findOneBy({
        id: sandboxId,
      });
      if (!sandbox) {
        //  edge case where sandbox is deleted while desired state is being processed
        return;
      }
      sandbox.state = SandboxState.ERROR;
      sandbox.errorReason = error.message || String(error);
      await this.sandboxRepository.save(sandbox);
    }

    await this.redisLockProvider.unlock(lockKey);
    if (syncState === SYNC_AGAIN) {
      this.syncInstanceState(sandboxId);
    }
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
