import { Volume } from "../entities/volume.entity";
import { VolumeState } from "../enums/volume-state.enum";

export class VolumeStateUpdatedEvent {
  constructor(
    public readonly volume: Volume,
    public readonly oldState: VolumeState,
    public readonly newState: VolumeState
  ) {}
}
