import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { SandboxUsagePeriods } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { RedisLockProvider } from "../../sandbox/common/redis-lock.provider";
import { SANDBOX_WARM_POOL_UNASSIGNED_ORGANIZATION } from "../../sandbox/constants/sandbox.constants";
import { SandboxEvents } from "../../sandbox/constants/sandbox-events.constants";
import { SandboxState } from "../../sandbox/enums/sandbox-state.enum";
import { SandboxStateUpdatedEvent } from "../../sandbox/events/sandbox-state-updated.event";
import { BillingService } from "./billing.service";

/**
 * Service responsible for tracking and managing sandbox resource usage.
 */
@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisLockProvider: RedisLockProvider,
    @Inject(forwardRef(() => BillingService))
    private readonly billingService: BillingService
  ) {}

  /**
   * Handles sandbox state changes to start or stop usage periods.
   * A lock is acquired for the specific sandbox to prevent race conditions.
   * @param event - The event payload containing sandbox state details.
   */
  @OnEvent(SandboxEvents.STATE_UPDATED)
  async handleSandboxStateUpdate(event: SandboxStateUpdatedEvent): Promise<void> {
    await this.waitForLock(event.sandbox.id);

    try {
      switch (event.newState) {
        case SandboxState.STARTED:
          // A sandbox starting means a previous period should be closed
          // and a new one for full resource usage (CPU, GPU, etc.) should begin.
          await this.closeUsagePeriod(event.sandbox.id);
          await this.createUsagePeriod(event, false);
          break;

        case SandboxState.STOPPED:
          // A stopped sandbox transitions to disk-only usage.
          await this.closeUsagePeriod(event.sandbox.id);
          await this.createUsagePeriod(event, true);
          break;

        case SandboxState.ERROR:
        case SandboxState.BUILD_FAILED:
        case SandboxState.ARCHIVED:
        case SandboxState.DESTROYED:
          // These terminal states signify the end of any usage.
          await this.closeUsagePeriod(event.sandbox.id);
          break;
      }
    } finally {
      this.releaseLock(event.sandbox.id).catch((error) => {
        this.logger.error(`Error releasing lock for sandbox ${event.sandbox.id}`, error);
      });
    }
  }

  /**
   * Creates a new usage period record for a sandbox.
   * @param event - The event payload with sandbox details.
   * @param diskOnly - If true, only disk usage is recorded; CPU, GPU, and memory are set to 0.
   */
  private async createUsagePeriod(
    event: SandboxStateUpdatedEvent,
    diskOnly = false
  ): Promise<void> {
    const { sandbox } = event;
    await this.prisma.sandboxUsagePeriods.create({
      data: {
        sandboxId: sandbox.id,
        organizationId: sandbox.organizationId,
        region: sandbox.region,
        disk: sandbox.disk,
        startAt: new Date(),
        endAt: null,
        // Set compute resources based on the diskOnly flag.
        cpu: diskOnly ? 0 : sandbox.cpu,
        gpu: diskOnly ? 0 : sandbox.gpu,
        mem: diskOnly ? 0 : sandbox.mem,
        billed: false,
      },
    });
  }

  /**
   * Closes the most recent open usage period for a given sandbox.
   * @param sandboxId - The ID of the sandbox whose usage period should be closed.
   */
  private async closeUsagePeriod(sandboxId: string): Promise<void> {
    const lastUsagePeriod = await this.prisma.sandboxUsagePeriods.findFirst({
      where: {
        sandboxId,
        endAt: null,
      },
      orderBy: {
        startAt: "desc",
      },
    });

    if (lastUsagePeriod) {
      const endAt = new Date();
      const savedPeriod = await this.prisma.sandboxUsagePeriods.update({
        where: { id: lastUsagePeriod.id },
        data: { endAt },
      });

      // Trigger billing for the completed usage period
      this.processBillingAsync(savedPeriod);
    }
  }

  /**
   * Processes billing for a usage period asynchronously to avoid blocking the main flow.
   */
  private processBillingAsync(usagePeriod: SandboxUsagePeriods): void {
    // Use setImmediate to process billing in the next tick
    setImmediate(async () => {
      try {
        await this.billingService.processBillingForUsagePeriod(usagePeriod);
      } catch (error) {
        this.logger.error(`Error processing billing for usage period ${usagePeriod.id}`, error);
      }
    });
  }

  /**
   * A cron job that runs every minute to close and reopen long-running usage periods.
   * This ensures that usage is billed or recorded periodically (e.g., daily).
   * Also handles orphaned periods from failed operations or timeouts.
   */
  @Cron(CronExpression.EVERY_MINUTE, { name: "close-and-reopen-usage-periods" })
  async closeAndReopenUsagePeriods(): Promise<void> {
    const lockAcquired = await this.redisLockProvider.lock("close-and-reopen-usage-periods", 60);
    if (!lockAcquired) {
      return;
    }

    try {
      // Find active usage periods older than 24 hours for non-warm-pool sandboxes.
      const usagePeriods = await this.prisma.sandboxUsagePeriods.findMany({
        where: {
          endAt: null,
          startAt: {
            lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
          },
          organizationId: {
            not: SANDBOX_WARM_POOL_UNASSIGNED_ORGANIZATION,
          },
        },
        orderBy: {
          startAt: "asc",
        },
        take: 100,
      });

      for (const usagePeriod of usagePeriods) {
        if (!(await this.acquireLock(usagePeriod.sandboxId))) continue;

        try {
          await this.prisma.$transaction(async (prisma) => {
            const closeTime = new Date();

            // Update the existing period to close it
            const savedPeriod = await prisma.sandboxUsagePeriods.update({
              where: { id: usagePeriod.id },
              data: { endAt: closeTime },
            });

            // Create a new period starting immediately after the old one ended.
            await prisma.sandboxUsagePeriods.create({
              data: {
                sandboxId: usagePeriod.sandboxId,
                organizationId: usagePeriod.organizationId,
                region: usagePeriod.region,
                disk: usagePeriod.disk,
                cpu: usagePeriod.cpu,
                gpu: usagePeriod.gpu,
                mem: usagePeriod.mem,
                startAt: closeTime,
                endAt: null,
                billed: false,
              },
            });

            // Process billing for the closed period
            this.processBillingAsync(savedPeriod);
          });
        } catch (error) {
          this.logger.error(
            `Error closing and reopening usage period for sandbox ${usagePeriod.sandboxId}`,
            error
          );
        } finally {
          await this.releaseLock(usagePeriod.sandboxId);
        }
      }
    } finally {
      await this.redisLockProvider.unlock("close-and-reopen-usage-periods");
    }
  }

  /**
   * Waits indefinitely to acquire a lock for a given sandbox ID.
   * This uses a polling mechanism to check for the lock's availability.
   * @param sandboxId - The ID of the sandbox to lock.
   */
  private async waitForLock(sandboxId: string): Promise<void> {
    while (!(await this.acquireLock(sandboxId))) {
      // Wait for 500ms before retrying to avoid busy-waiting.
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  /**
   * Acquires a Redis-based lock for a specific sandbox.
   * @param sandboxId - The sandbox ID to use in the lock key.
   * @returns A promise that resolves to true if the lock was acquired, false otherwise.
   */
  private async acquireLock(sandboxId: string): Promise<boolean> {
    return this.redisLockProvider.lock(`usage-period-${sandboxId}`, 60);
  }

  /**
   * Releases the Redis-based lock for a specific sandbox.
   * @param sandboxId - The sandbox ID to use in the lock key.
   */
  private async releaseLock(sandboxId: string): Promise<void> {
    await this.redisLockProvider.unlock(`usage-period-${sandboxId}`);
  }
}
