import { Snapshot } from "../entities/snapshot.entity";
import { SnapshotState } from "../enums/snapshot-state.enum";

export class SnapshotStateUpdatedEvent {
  constructor(
    public readonly snapshot: Snapshot,
    public readonly oldState: SnapshotState,
    public readonly newState: SnapshotState,
  ) {}
}
