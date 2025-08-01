import { MiddlewareConsumer, Module, RequestMethod } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { OrganizationModule } from "../organization/organization.module";
import { Registry } from "../registry/entities/registry.entity";
import { DockerRegistryModule } from "../registry/registry.module";
import { UserModule } from "../user/user.module";
import { RedisLockProvider } from "./common/redis-lock.provider";
import { BucketController } from "./controllers/bucket.controller";
import { ExecutorController } from "./controllers/executor.controller";
import { ImageController } from "./controllers/image.controller";
import { PreviewController } from "./controllers/preview.controller";
import { SandboxController } from "./controllers/sandbox.controller";
import { ToolboxController } from "./controllers/toolbox.controller";
import { DockerProvider } from "./docker/docker-provider";
import { Bucket } from "./entities/bucket.entity";
import { BuildInfo } from "./entities/build-info.entity";
import { Executor } from "./entities/executor.entity";
import { Image } from "./entities/image.entity";
import { ImageExecutor } from "./entities/image-executor.entity";
import { Sandbox } from "./entities/sandbox.entity";
import { WarmPool } from "./entities/warm-pool.entity";
import { ExecutorApiFactory } from "./executor-api/executor-api";
import { BackupManager } from "./managers/backup.manager";
import { BucketManager } from "./managers/bucket.manager";
import { ImageManager } from "./managers/image.manager";
import { SandboxManager } from "./managers/sandbox.manager";
import { RequestLoggerMiddleware } from "./middleware/request-logger.middleware";
import { BucketService } from "./services/bucket.service";
import { ExecutorService } from "./services/executor.service";
import { ImageService } from "./services/image.service";
import { ImageExecutorService } from "./services/image-executor.service";
import { SandboxService } from "./services/sandbox.service";
import { SandboxWarmPoolService } from "./services/sandbox-warm-pool.service";
import { ToolboxService } from "./services/toolbox.service";
import { BucketSubscriber } from "./subscribers/bucket.subscriber";
import { ImageSubscriber } from "./subscribers/image.subscriber";
import { SandboxSubscriber } from "./subscribers/sandbox.subscriber";
import { BucketTool } from "./tools/bucket.tool";

@Module({
  imports: [
    UserModule,
    AuthModule,
    DockerRegistryModule,
    OrganizationModule,
    TypeOrmModule.forFeature([
      Sandbox,
      Executor,
      Image,
      BuildInfo,
      ImageExecutor,
      Registry,
      WarmPool,
      Bucket,
    ]),
  ],
  controllers: [
    SandboxController,
    ExecutorController,
    ToolboxController,
    ImageController,
    PreviewController,
    BucketController,
  ],
  providers: [
    SandboxService,
    SandboxManager,
    BackupManager,
    SandboxWarmPoolService,
    ExecutorService,
    ExecutorApiFactory,
    ToolboxService,
    ImageService,
    ImageManager,
    DockerProvider,
    SandboxSubscriber,
    RedisLockProvider,
    ImageSubscriber,
    BucketService,
    BucketManager,
    BucketSubscriber,
    ImageExecutorService,
    BucketTool,
  ],
  exports: [
    SandboxService,
    ExecutorService,
    RedisLockProvider,
    ImageService,
    BucketService,
    BucketManager,
    ImageExecutorService,
  ],
})
export class SandboxModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestLoggerMiddleware)
      .forRoutes({ path: "sandbox", method: RequestMethod.POST });
  }
}
