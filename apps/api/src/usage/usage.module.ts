import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Organization } from "../organization/entities/organization.entity";
import { OrganizationModule } from "../organization/organization.module";
import { RedisLockProvider } from "../sandbox/common/redis-lock.provider";
import { SandboxModule } from "../sandbox/sandbox.module";
import { SandboxUsagePeriod } from "./sandbox-usage-period.entity";
import { BillingService } from "./services/billing.service";
import { UsageService } from "./services/usage.service";

/**
 * The NestJS module for handling resource usage tracking and billing.
 * It imports the SandboxUsagePeriod entity and provides the UsageService and BillingService for other modules.
 * It also provides the RedisLockProvider for distributed locking.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SandboxUsagePeriod, Organization]),
    forwardRef(() => OrganizationModule),
    forwardRef(() => SandboxModule),
  ],
  providers: [UsageService, BillingService, RedisLockProvider],
  exports: [UsageService, BillingService],
})
export class UsageModule {}
