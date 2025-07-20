import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { BucketEvents } from "../sandbox/constants/bucket-events.constants";
import { ImageEvents } from "../sandbox/constants/image-events.constants";
import { SandboxEvents } from "../sandbox/constants/sandbox-events.constants";
import { BucketDto } from "../sandbox/dto/bucket.dto";
import { ImageDto } from "../sandbox/dto/image.dto";
import { SandboxDto } from "../sandbox/dto/sandbox.dto";
import { BucketCreatedEvent } from "../sandbox/events/bucket-created.event";
import { BucketLastUsedAtUpdatedEvent } from "../sandbox/events/bucket-last-used-at-updated.event";
import { BucketStateUpdatedEvent } from "../sandbox/events/bucket-state-updated.event";
import { ImageCreatedEvent } from "../sandbox/events/image-created.event";
import { ImageEnabledToggledEvent } from "../sandbox/events/image-enabled-toggled.event";
import { ImageRemovedEvent } from "../sandbox/events/image-removed.event";
import { ImageStateUpdatedEvent } from "../sandbox/events/image-state-updated.event";
import { SandboxCreatedEvent } from "../sandbox/events/sandbox-create.event";
import { SandboxDesiredStateUpdatedEvent } from "../sandbox/events/sandbox-desired-state-updated.event";
import { SandboxStateUpdatedEvent } from "../sandbox/events/sandbox-state-updated.event";
import { ExecutorService } from "../sandbox/services/executor.service";
import { RealtimeGateway } from "./realtime.gateway";

@Injectable()
export class RealtimeService {
  constructor(
    private readonly realtimeGateway: RealtimeGateway,
    private readonly executorService: ExecutorService
  ) {}

  @OnEvent(SandboxEvents.CREATED)
  async handleSandboxCreated(event: SandboxCreatedEvent) {
    const executor = await this.executorService.findOne(event.sandbox.executorId);
    const dto = SandboxDto.fromSandbox(event.sandbox, executor.domain);
    this.realtimeGateway.emitSandboxCreated(dto);
  }

  @OnEvent(SandboxEvents.STATE_UPDATED)
  async handleSandboxStateUpdated(event: SandboxStateUpdatedEvent) {
    const executor = await this.executorService.findOne(event.sandbox.executorId);
    const dto = SandboxDto.fromSandbox(event.sandbox, executor.domain);
    this.realtimeGateway.emitSandboxStateUpdated(dto, event.oldState, event.newState);
  }

  @OnEvent(SandboxEvents.DESIRED_STATE_UPDATED)
  async handleSandboxDesiredStateUpdated(event: SandboxDesiredStateUpdatedEvent) {
    const executor = await this.executorService.findOne(event.sandbox.executorId);
    const dto = SandboxDto.fromSandbox(event.sandbox, executor.domain);
    this.realtimeGateway.emitSandboxDesiredStateUpdated(
      dto,
      event.oldDesiredState,
      event.newDesiredState
    );
  }

  @OnEvent(ImageEvents.CREATED)
  async handleImageCreated(event: ImageCreatedEvent) {
    const dto = ImageDto.fromImage(event.image);
    this.realtimeGateway.emitImageCreated(dto);
  }

  @OnEvent(ImageEvents.STATE_UPDATED)
  async handleImageStateUpdated(event: ImageStateUpdatedEvent) {
    const dto = ImageDto.fromImage(event.image);
    this.realtimeGateway.emitImageStateUpdated(dto, event.oldState, event.newState);
  }

  @OnEvent(ImageEvents.ENABLED_TOGGLED)
  async handleImageEnabledToggled(event: ImageEnabledToggledEvent) {
    const dto = ImageDto.fromImage(event.image);
    this.realtimeGateway.emitImageEnabledToggled(dto);
  }

  @OnEvent(ImageEvents.REMOVED)
  async handleImageRemoved(event: ImageRemovedEvent) {
    const dto = ImageDto.fromImage(event.image);
    this.realtimeGateway.emitImageRemoved(dto);
  }

  @OnEvent(BucketEvents.CREATED)
  async handleBucketCreated(event: BucketCreatedEvent) {
    const dto = BucketDto.fromBucket(event.bucket);
    this.realtimeGateway.emitBucketCreated(dto);
  }

  @OnEvent(BucketEvents.STATE_UPDATED)
  async handleBucketStateUpdated(event: BucketStateUpdatedEvent) {
    const dto = BucketDto.fromBucket(event.bucket);
    this.realtimeGateway.emitBucketStateUpdated(dto, event.oldState, event.newState);
  }

  @OnEvent(BucketEvents.LAST_USED_AT_UPDATED)
  async handleBucketLastUsedAtUpdated(event: BucketLastUsedAtUpdatedEvent) {
    const dto = BucketDto.fromBucket(event.bucket);
    this.realtimeGateway.emitBucketLastUsedAtUpdated(dto);
  }
}
