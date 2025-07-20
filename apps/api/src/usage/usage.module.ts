import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RedisLockProvider } from "../sandbox/common/redis-lock.provider";
import { SandboxUsagePeriod } from "./sandbox-usage-period.entity";
import { UsageService } from "./usage.service";

/**
 * The NestJS module for handling resource usage tracking.
 * It imports the SandboxUsagePeriod entity and provides the UsageService for other modules.
 * It also provides the RedisLockProvider for distributed locking.
 */
@Module({
  imports: [TypeOrmModule.forFeature([SandboxUsagePeriod])],
  providers: [UsageService, RedisLockProvider],
  exports: [UsageService],
})
export class UsageModule {}
