import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { InjectRedis } from "@nestjs-modules/ioredis";
import { Redis } from "ioredis";
import { filter } from "rxjs";
import { FindOptionsWhere, In, MoreThan, Not, Repository } from "typeorm";
import { validate as uuidValidate } from "uuid";
import { BadRequestError } from "../../common/exceptions/bad-request.exception";
import { RedisLockProvider } from "../common/redis-lock.provider";
import { SANDBOX_WARM_POOL_UNASSIGNED_ORGANIZATION } from "../constants/sandbox.constants";
import { SandboxEvents } from "../constants/sandbox-events.constants";
import { WarmPoolEvents } from "../constants/warmpool-events.constants";
import { Executor } from "../entities/executor.entity";
import { Image } from "../entities/image.entity";
import { Sandbox } from "../entities/sandbox.entity";
import { WarmPool } from "../entities/warm-pool.entity";
import { ExecutorRegion } from "../enums/executor-region.enum";
import { ImageState } from "../enums/image-state.enum";
import { SandboxClass } from "../enums/sandbox-class.enum";
import { SandboxDesiredState } from "../enums/sandbox-desired-state.enum";
import { SandboxState } from "../enums/sandbox-state.enum";
import { SandboxOrganizationUpdatedEvent } from "../events/sandbox-organization-updated.event";
import { WarmPoolTopUpRequested } from "../events/warmpool-topup-requested.event";

export type FetchWarmPoolSandboxParams = {
  image: string;
  target: ExecutorRegion;
  class: SandboxClass;
  cpu: number;
  mem: number;
  disk: number;
  osUser: string;
  env: { [key: string]: string };
  organizationId: string;
  state: string;
};

@Injectable()
export class SandboxWarmPoolService {
  private readonly logger = new Logger(SandboxWarmPoolService.name);

  constructor(
    @InjectRepository(WarmPool)
    private readonly warmPoolRepository: Repository<WarmPool>,
    @InjectRepository(Sandbox)
    private readonly sandboxRepository: Repository<Sandbox>,
    @InjectRepository(Image)
    private readonly imageRepository: Repository<Image>,
    @InjectRepository(Executor)
    private readonly executorRepository: Repository<Executor>,
    private readonly redisLockProvider: RedisLockProvider,
    private readonly configService: ConfigService,
    @Inject(EventEmitter2)
    private eventEmitter: EventEmitter2,
    @InjectRedis() private readonly redis: Redis
  ) {}

  //  on init
  async onApplicationBootstrap() {
    //  await this.adHocBackupCheck()
  }

  async fetchWarmPoolSandbox(params: FetchWarmPoolSandboxParams): Promise<Sandbox | null> {
    //  validate image
    const sandboxImage = params.image || this.configService.get<string>("DEFAULT_IMAGE");

    const imageFilter: FindOptionsWhere<Image>[] = [
      {
        organizationId: params.organizationId,
        name: sandboxImage,
        state: ImageState.ACTIVE,
      },
      { general: true, name: sandboxImage, state: ImageState.ACTIVE },
    ];

    if (uuidValidate(sandboxImage)) {
      imageFilter.push(
        {
          organizationId: params.organizationId,
          id: sandboxImage,
          state: ImageState.ACTIVE,
        },
        { general: true, id: sandboxImage, state: ImageState.ACTIVE }
      );
    }

    const image = await this.imageRepository.findOne({
      where: imageFilter,
    });

    if (!image) throw new BadRequestError(`Image ${sandboxImage} not found.`);

    //  check if sandbox is warm pool
    const warmPoolItem = await this.warmPoolRepository.findOne({
      where: {
        image: image.name,
        target: params.target,
        class: params.class,
        cpu: params.cpu,
        mem: params.mem,
        disk: params.disk,
        osUser: params.osUser,
        env: params.env,
        pool: MoreThan(0),
      },
    });
    if (warmPoolItem) {
      const unschedulableExecutors = await this.executorRepository.find({
        where: {
          region: params.target,
          unschedulable: true,
        },
      });

      const warmPoolSandboxes = await this.sandboxRepository.find({
        where: {
          executorId: Not(In(unschedulableExecutors.map((executor) => executor.id))),
          class: warmPoolItem.class,
          cpu: warmPoolItem.cpu,
          mem: warmPoolItem.mem,
          disk: warmPoolItem.disk,
          image: image.name, // Use image.name instead of sandboxImage
          osUser: warmPoolItem.osUser,
          env: warmPoolItem.env,
          organizationId: SANDBOX_WARM_POOL_UNASSIGNED_ORGANIZATION,
          region: warmPoolItem.target,
          state: SandboxState.STARTED,
        },
        take: 10,
      });

      //  make sure we only release warm pool sandbox once
      let warmPoolSandbox: Sandbox | null = null;
      for (const sandbox of warmPoolSandboxes) {
        const lockKey = `sandbox-warm-pool-${sandbox.id}`;
        if (!(await this.redisLockProvider.lock(lockKey, 10))) {
          continue;
        }

        warmPoolSandbox = sandbox;
        break;
      }

      return warmPoolSandbox;
    }

    return null;
  }

  //  todo: make frequency configurable or more efficient
  @Cron(CronExpression.EVERY_10_SECONDS, { name: "warm-pool-check" })
  async warmPoolCheck(): Promise<void> {
    const warmPoolItems = await this.warmPoolRepository.find();

    await Promise.all(
      warmPoolItems.map(async (warmPoolItem) => {
        const lockKey = `warm-pool-lock-${warmPoolItem.id}`;
        if (!(await this.redisLockProvider.lock(lockKey, 720))) {
          return;
        }

        const sandboxCount = await this.sandboxRepository.count({
          where: {
            image: warmPoolItem.image,
            organizationId: SANDBOX_WARM_POOL_UNASSIGNED_ORGANIZATION,
            class: warmPoolItem.class,
            osUser: warmPoolItem.osUser,
            env: warmPoolItem.env,
            region: warmPoolItem.target,
            cpu: warmPoolItem.cpu,
            gpu: warmPoolItem.gpu,
            mem: warmPoolItem.mem,
            disk: warmPoolItem.disk,
            desiredState: SandboxDesiredState.STARTED,
            state: Not(In([SandboxState.ERROR, SandboxState.BUILD_FAILED])),
          },
        });

        const missingCount = warmPoolItem.pool - sandboxCount;
        if (missingCount > 0) {
          const promises = [];
          this.logger.debug(
            `Creating ${missingCount} sandboxes for warm pool id ${warmPoolItem.id}`
          );

          for (let i = 0; i < missingCount; i++) {
            promises.push(
              this.eventEmitter.emitAsync(
                WarmPoolEvents.TOPUP_REQUESTED,
                new WarmPoolTopUpRequested(warmPoolItem)
              )
            );
          }

          // Wait for all promises to settle before releasing the lock. Otherwise, another worker could start creating sandboxes
          await Promise.allSettled(promises);
        }

        await this.redisLockProvider.unlock(lockKey);
      })
    );
  }

  @OnEvent(SandboxEvents.ORGANIZATION_UPDATED)
  async handleSandboxOrganizationUpdated(event: SandboxOrganizationUpdatedEvent) {
    if (event.newOrganizationId === SANDBOX_WARM_POOL_UNASSIGNED_ORGANIZATION) {
      return;
    }
    const warmPoolItem = await this.warmPoolRepository.findOne({
      where: {
        image: event.sandbox.image,
        class: event.sandbox.class,
        cpu: event.sandbox.cpu,
        mem: event.sandbox.mem,
        disk: event.sandbox.disk,
        target: event.sandbox.region,
        env: event.sandbox.env,
        gpu: event.sandbox.gpu,
        osUser: event.sandbox.osUser,
      },
    });

    if (!warmPoolItem) {
      return;
    }

    const sandboxCount = await this.sandboxRepository.count({
      where: {
        image: warmPoolItem.image,
        organizationId: SANDBOX_WARM_POOL_UNASSIGNED_ORGANIZATION,
        class: warmPoolItem.class,
        osUser: warmPoolItem.osUser,
        env: warmPoolItem.env,
        region: warmPoolItem.target,
        cpu: warmPoolItem.cpu,
        gpu: warmPoolItem.gpu,
        mem: warmPoolItem.mem,
        disk: warmPoolItem.disk,
        desiredState: SandboxDesiredState.STARTED,
        state: Not(In([SandboxState.ERROR, SandboxState.BUILD_FAILED])),
      },
    });

    if (warmPoolItem.pool <= sandboxCount) return;

    if (warmPoolItem)
      this.eventEmitter.emit(
        WarmPoolEvents.TOPUP_REQUESTED,
        new WarmPoolTopUpRequested(warmPoolItem)
      );
  }
}
