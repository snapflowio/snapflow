import { Image } from "../entities/image.entity";

export class ImageEnabledToggledEvent {
  constructor(public readonly image: Image) {}
}
