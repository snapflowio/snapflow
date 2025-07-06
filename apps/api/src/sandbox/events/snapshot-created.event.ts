import { Snapshot } from "../entities/snapshot.entity";

export class SnapshotCreatedEvent {
  constructor(public readonly snapshot: Snapshot) {}
}
