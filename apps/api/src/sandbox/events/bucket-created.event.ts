import { Bucket } from "../entities/bucket.entity";

export class BucketCreatedEvent {
  constructor(public readonly bucket: Bucket) {}
}
