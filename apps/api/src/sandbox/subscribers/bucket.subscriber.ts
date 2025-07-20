import { Inject } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
} from "typeorm";
import { BucketEvents } from "../constants/bucket-events.constants";
import { Bucket } from "../entities/bucket.entity";
import { BucketCreatedEvent } from "../events/bucket-created.event";
import { BucketLastUsedAtUpdatedEvent } from "../events/bucket-last-used-at-updated.event";
import { BucketStateUpdatedEvent } from "../events/bucket-state-updated.event";

@EventSubscriber()
export class BucketSubscriber implements EntitySubscriberInterface<Bucket> {
  @Inject(EventEmitter2)
  private eventEmitter: EventEmitter2;

  constructor(dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return Bucket;
  }

  afterInsert(event: InsertEvent<Bucket>) {
    this.eventEmitter.emit(BucketEvents.CREATED, new BucketCreatedEvent(event.entity as Bucket));
  }

  afterUpdate(event: UpdateEvent<Bucket>) {
    const updatedColumns = event.updatedColumns.map((col) => col.propertyName);

    updatedColumns.forEach((column) => {
      switch (column) {
        case "state":
          this.eventEmitter.emit(
            BucketEvents.STATE_UPDATED,
            new BucketStateUpdatedEvent(
              event.entity as Bucket,
              event.databaseEntity[column],
              event.entity[column]
            )
          );
          break;
        case "lastUsedAt":
          this.eventEmitter.emit(
            BucketEvents.LAST_USED_AT_UPDATED,
            new BucketLastUsedAtUpdatedEvent(event.entity as Bucket)
          );
          break;
        default:
          break;
      }
    });
  }
}
