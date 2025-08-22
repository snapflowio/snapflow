import { forwardRef, Module } from "@nestjs/common";
import { OrganizationModule } from "../organization/organization.module";
import { RedisLockProvider } from "../sandbox/common/redis-lock.provider";
import { SandboxModule } from "../sandbox/sandbox.module";
import { BillingService } from "./services/billing.service";
import { UsageService } from "./services/usage.service";

/**
 * The NestJS module for handling resource usage tracking and billing.
 * It provides the UsageService and BillingService for other modules.
 * It also provides the RedisLockProvider for distributed locking.
 */
@Module({
  imports: [forwardRef(() => OrganizationModule), forwardRef(() => SandboxModule)],
  providers: [UsageService, BillingService, RedisLockProvider],
  exports: [UsageService, BillingService],
})
export class UsageModule {}
