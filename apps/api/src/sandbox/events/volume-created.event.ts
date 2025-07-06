import { Volume } from "../entities/volume.entity";

export class VolumeCreatedEvent {
  constructor(public readonly volume: Volume) {}
}
