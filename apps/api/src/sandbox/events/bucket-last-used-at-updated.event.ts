import { Bucket } from "../entities/bucket.entity";

export class BucketLastUsedAtUpdatedEvent {
  constructor(public readonly bucket: Bucket) {}
}
