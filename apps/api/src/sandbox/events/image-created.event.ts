import { Image } from "../entities/image.entity";

export class ImageCreatedEvent {
  constructor(public readonly image: Image) {}
}
