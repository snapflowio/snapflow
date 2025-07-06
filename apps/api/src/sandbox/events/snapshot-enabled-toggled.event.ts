import { Snapshot } from "../entities/snapshot.entity";

export class SnapshotEnabledToggledEvent {
  constructor(public readonly snapshot: Snapshot) {}
}
