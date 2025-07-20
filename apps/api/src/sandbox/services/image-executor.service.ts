import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OrganizationEvents } from "../../organization/constants/organization-events.constant";
import { OrganizationSuspendedImageExecutorRemoveEvent } from "../../organization/events/organization-suspended-image-executor-removed";
import { ImageExecutor } from "../entities/image-executor.entity";
import { ImageExecutorState } from "../enums/image-executor-state.enum";

@Injectable()
export class ImageExecutorService {
  private readonly logger = new Logger(ImageExecutorService.name);

  constructor(
    @InjectRepository(ImageExecutor)
    private readonly imageExecutorRepository: Repository<ImageExecutor>
  ) {}

  async remove(imageExecutorId: string): Promise<void> {
    const imageExecutor = await this.imageExecutorRepository.findOne({
      where: {
        id: imageExecutorId,
      },
    });

    if (!imageExecutor) {
      throw new NotFoundException();
    }

    imageExecutor.state = ImageExecutorState.REMOVING;
    await this.imageExecutorRepository.save(imageExecutor);
  }

  @OnEvent(OrganizationEvents.SUSPENDED_IMAGE_RUNNER_REMOVED)
  async handleSuspendedImageExecutorRemoved(event: OrganizationSuspendedImageExecutorRemoveEvent) {
    await this.remove(event.imageExecutorId).catch((error) => {
      this.logger.error(
        `Error removing image executor from suspended organization. ImageExecutorId: ${event.imageExecutorId}: `,
        error
      );
    });
  }
}
