import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RedisLockProvider } from "../sandbox/common/redis-lock.provider";
import { SandboxUsagePeriod } from "./sandbox-usage-period.entity";
import { UsageService } from "./usage.service";

@Module({
  imports: [TypeOrmModule.forFeature([SandboxUsagePeriod])],
  providers: [UsageService, RedisLockProvider],
  exports: [UsageService],
})
export class UsageModule {}
