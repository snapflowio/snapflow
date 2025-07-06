import { MiddlewareConsumer, Module, RequestMethod } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AuthModule } from "../auth/auth.module";
import { DockerRegistryModule } from "../docker-registry/docker-registry.module";
import { DockerRegistry } from "../docker-registry/entities/docker-registry.entity";
import { OrganizationModule } from "../organization/organization.module";
import { UserModule } from "../user/user.module";
import { RedisLockProvider } from "./common/redis-lock.provider";
import { PreviewController } from "./controllers/preview.controller";
import { RunnerController } from "./controllers/runner.controller";
import { SandboxController } from "./controllers/sandbox.controller";
import { SnapshotController } from "./controllers/snapshot.controller";
import { ToolboxController } from "./controllers/toolbox.controller";
import { VolumeController } from "./controllers/volume.controller";
import { DockerProvider } from "./docker/docker-provider";
import { BuildInfo } from "./entities/build-info.entity";
import { Runner } from "./entities/runner.entity";
import { Sandbox } from "./entities/sandbox.entity";
import { Snapshot } from "./entities/snapshot.entity";
import { SnapshotRunner } from "./entities/snapshot-runner.entity";
import { Volume } from "./entities/volume.entity";
import { WarmPool } from "./entities/warm-pool.entity";
import { RunnerApiFactory } from "./manager-api/manager-api";
import { BackupManager } from "./managers/backup.manager";
import { SandboxManager } from "./managers/sandbox.manager";
import { SnapshotManager } from "./managers/snapshot.manager";
import { VolumeManager } from "./managers/volume.manager";
import { RequestLoggerMiddleware } from "./middleware/request-logger.middleware";
import { RunnerService } from "./services/runner.service";
import { SandboxService } from "./services/sandbox.service";
import { SandboxWarmPoolService } from "./services/sandbox-warm-pool.service";
import { SnapshotService } from "./services/snapshot.service";
import { SnapshotRunnerService } from "./services/snapshot-runner.service";
import { ToolboxService } from "./services/toolbox.service";
import { VolumeService } from "./services/volume.service";
import { SandboxSubscriber } from "./subscribers/sandbox.subscriber";
import { SnapshotSubscriber } from "./subscribers/snapshot.subscriber";
import { VolumeSubscriber } from "./subscribers/volume.subscriber";

@Module({
  imports: [
    UserModule,
    AuthModule,
    DockerRegistryModule,
    OrganizationModule,
    TypeOrmModule.forFeature([
      Sandbox,
      Runner,
      Snapshot,
      BuildInfo,
      SnapshotRunner,
      DockerRegistry,
      WarmPool,
      Volume,
    ]),
  ],
  controllers: [
    SandboxController,
    RunnerController,
    ToolboxController,
    SnapshotController,
    PreviewController,
    VolumeController,
  ],
  providers: [
    SandboxService,
    SandboxManager,
    BackupManager,
    SandboxWarmPoolService,
    RunnerService,
    RunnerApiFactory,
    ToolboxService,
    SnapshotService,
    SnapshotManager,
    DockerProvider,
    SandboxSubscriber,
    RedisLockProvider,
    SnapshotSubscriber,
    VolumeService,
    VolumeManager,
    VolumeSubscriber,
    SnapshotRunnerService,
  ],
  exports: [
    SandboxService,
    RunnerService,
    RedisLockProvider,
    SnapshotService,
    VolumeService,
    VolumeManager,
    SnapshotRunnerService,
  ],
})
export class SandboxModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestLoggerMiddleware)
      .forRoutes({ path: "sandbox", method: RequestMethod.POST });
  }
}
