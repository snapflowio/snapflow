import { Snapshot } from "../entities/snapshot.entity";

export class SnapshotRemovedEvent {
  constructor(public readonly snapshot: Snapshot) {}
}
