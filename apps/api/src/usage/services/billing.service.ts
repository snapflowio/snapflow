import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { SandboxUsagePeriods } from "@prisma/client";
import {
  CPU_CORE_PER_SECOND_PRICE,
  MEMORY_GIG_PER_SECOND_PRICE,
} from "../../common/constants/prices.constants";
import { WrapperType } from "../../common/types/wrapper.type";
import { PrismaService } from "../../database/prisma.service";
import { OrganizationService } from "../../organization/services/organization.service";
import { RedisLockProvider } from "../../sandbox/common/redis-lock.provider";
import { SandboxService } from "../../sandbox/services/sandbox.service";

/**
 * Service responsible for calculating usage costs and deducting credits from organization wallet.
 * Integrates with the existing usage tracking system to process billing automatically.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationService: OrganizationService,
    @Inject(forwardRef(() => SandboxService))
    private readonly sandboxService: WrapperType<SandboxService>,
    private readonly eventEmitter: EventEmitter2,
    private readonly redisLockProvider: RedisLockProvider
  ) {}

  /**
   * Processes billing for completed usage periods.
   * Called when usage periods are closed to calculate and deduct costs.
   */
  async processBillingForUsagePeriod(usagePeriod: SandboxUsagePeriods): Promise<void> {
    // Skip if already billed
    if (usagePeriod.billed) {
      return;
    }

    const lockKey = `billing-${usagePeriod.organizationId}`;
    const lockAcquired = await this.redisLockProvider.lock(lockKey, 30);

    if (!lockAcquired) {
      this.logger.warn(
        `Could not acquire billing lock for organization ${usagePeriod.organizationId}`
      );
      return;
    }

    try {
      const organization = await this.prisma.organization.findUnique({
        where: { id: usagePeriod.organizationId },
      });

      if (!organization) {
        this.logger.error(`Organization ${usagePeriod.organizationId} not found for billing`);
        return;
      }

      const cost = this.calculateUsageCost(usagePeriod);

      if (cost <= 0) {
        // Mark as billed even if no cost to prevent reprocessing
        await this.prisma.sandboxUsagePeriods.update({
          where: { id: usagePeriod.id },
          data: { billed: true },
        });
        return;
      }

      const currentBalance = Number.parseFloat(organization.wallet.toString()) || 0.0;
      const newBalance = Math.max(0, currentBalance - cost);

      this.logger.log(
        `Processing billing for organization ${organization.id}: ` +
          `cost=${cost.toFixed(6)}, balance=${currentBalance.toFixed(6)} -> ${newBalance.toFixed(6)}`
      );

      // Update wallet balance and mark period as billed in a transaction
      await this.prisma.$transaction(async (prisma) => {
        await prisma.organization.update({
          where: { id: organization.id },
          data: { wallet: newBalance.toFixed(6) },
        });

        await prisma.sandboxUsagePeriods.update({
          where: { id: usagePeriod.id },
          data: { billed: true },
        });
      });

      // If balance reaches zero, stop all running sandboxes
      if (newBalance <= 0 && currentBalance > 0) {
        await this.handleZeroBalance(organization.id);
      }
    } catch (error) {
      this.logger.error(`Error processing billing for usage period ${usagePeriod.id}`, error);
    } finally {
      await this.redisLockProvider.unlock(lockKey);
    }
  }

  /**
   * Calculates the cost for a specific usage period based on CPU and memory consumption.
   * Uses the pricing constants for per-second resource costs.
   */
  private calculateUsageCost(usagePeriod: SandboxUsagePeriods): number {
    if (!usagePeriod.endAt) {
      return 0; // Cannot calculate cost for open periods
    }

    const durationSeconds = (usagePeriod.endAt.getTime() - usagePeriod.startAt.getTime()) / 1000;

    if (durationSeconds <= 0) {
      return 0;
    }

    // Calculate CPU cost (cores * seconds * price per core-second)
    const cpuCost = usagePeriod.cpu * durationSeconds * CPU_CORE_PER_SECOND_PRICE;

    // Calculate memory cost (GB * seconds * price per GB-second)
    const memoryCost = usagePeriod.mem * durationSeconds * MEMORY_GIG_PER_SECOND_PRICE;

    // Total cost (GPU pricing not implemented yet)
    const totalCost = cpuCost + memoryCost;

    this.logger.debug(
      `Usage cost calculation for period ${usagePeriod.id}: ` +
        `duration=${durationSeconds}s, cpu=${usagePeriod.cpu} cores, mem=${usagePeriod.mem}GB, ` +
        `cpuCost=${cpuCost.toFixed(6)}, memCost=${memoryCost.toFixed(6)}, total=${totalCost.toFixed(6)}`
    );

    return totalCost;
  }

  /**
   * Handles the scenario when an organization's balance reaches zero.
   * Stops all running sandboxes to prevent accumulating debt.
   */
  private async handleZeroBalance(organizationId: string): Promise<void> {
    this.logger.warn(`Organization ${organizationId} has zero balance, stopping all sandboxes`);

    try {
      await this.sandboxService.stopAllRunningSandboxes(organizationId);

      this.eventEmitter.emit("organization.balance.depleted", {
        organizationId,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Error stopping sandboxes for organization ${organizationId}`, error);
    }
  }

  /**
   * Gets the current wallet balance for an organization.
   */
  async getOrganizationBalance(organizationId: string): Promise<number> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new Error(`Organization ${organizationId} not found`);
    }

    return Number.parseFloat(organization.wallet.toString()) || 0.0;
  }

  /**
   * Checks if an organization has sufficient balance to start a new sandbox.
   * Uses a conservative estimate based on minimum expected usage.
   */
  async hasInsufficientBalance(
    organizationId: string,
    estimatedHourlyUsage = 1.0
  ): Promise<boolean> {
    const balance = await this.getOrganizationBalance(organizationId);
    const minimumRequiredBalance = estimatedHourlyUsage * 0.1; // Require at least 6 minutes of usage

    return balance < minimumRequiredBalance;
  }

  /**
   * Cron job to process pending billing every 5 minutes.
   * Ensures that any missed billing periods are processed regularly.
   */
  @Cron(CronExpression.EVERY_5_MINUTES, { name: "process-pending-billing" })
  async processPendingBillingCron(): Promise<void> {
    const lockAcquired = await this.redisLockProvider.lock("process-pending-billing", 300);
    if (!lockAcquired) {
      return;
    }

    try {
      await this.processPendingBilling();
    } finally {
      await this.redisLockProvider.unlock("process-pending-billing");
    }
  }

  /**
   * Processes billing for all completed usage periods that haven't been billed yet.
   * This method can be called periodically to ensure consistent billing.
   */
  async processPendingBilling(): Promise<void> {
    const completedPeriods = await this.prisma.sandboxUsagePeriods.findMany({
      where: {
        endAt: {
          lt: new Date(),
        },
        billed: false,
      },
      take: 100,
      orderBy: { endAt: "asc" },
    });

    this.logger.log(`Processing ${completedPeriods.length} unbilled usage periods`);

    for (const period of completedPeriods) {
      await this.processBillingForUsagePeriod(period);
    }
  }
}
