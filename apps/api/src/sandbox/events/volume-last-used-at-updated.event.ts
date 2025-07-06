import { Volume } from "../entities/volume.entity";

export class VolumeLastUsedAtUpdatedEvent {
  constructor(public readonly volume: Volume) {}
}
