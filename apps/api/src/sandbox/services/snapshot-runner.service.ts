import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OrganizationEvents } from "../../organization/constants/organization-events.constant";
import { OrganizationSuspendedSnapshotRunnerRemoveEvent } from "../../organization/events/organization-suspended-snapshot-runner-removed";
import { SnapshotRunner } from "../entities/snapshot-runner.entity";
import { SnapshotRunnerState } from "../enums/snapshot-runner-state.enum";

@Injectable()
export class SnapshotRunnerService {
  private readonly logger = new Logger(SnapshotRunnerService.name);

  constructor(
    @InjectRepository(SnapshotRunner)
    private readonly snapshotRunnerRepository: Repository<SnapshotRunner>
  ) {}

  async remove(snapshotRunnerId: string): Promise<void> {
    const snapshotRunner = await this.snapshotRunnerRepository.findOne({
      where: {
        id: snapshotRunnerId,
      },
    });

    if (!snapshotRunner) {
      throw new NotFoundException();
    }

    snapshotRunner.state = SnapshotRunnerState.REMOVING;
    await this.snapshotRunnerRepository.save(snapshotRunner);
  }

  @OnEvent(OrganizationEvents.SUSPENDED_SNAPSHOT_RUNNER_REMOVED)
  async handleSuspendedSnapshotRunnerRemoved(
    event: OrganizationSuspendedSnapshotRunnerRemoveEvent
  ) {
    await this.remove(event.snapshotRunnerId).catch((error) => {
      this.logger.error(
        `Error removing snapshot runner from suspended organization. SnapshotRunnerId: ${event.snapshotRunnerId}: `,
        error
      );
    });
  }
}
