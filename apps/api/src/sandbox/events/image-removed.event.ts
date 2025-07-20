import { Image } from "../entities/image.entity";

export class ImageRemovedEvent {
  constructor(public readonly image: Image) {}
}
