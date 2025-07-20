import { Bucket } from "../entities/bucket.entity";
import { BucketState } from "../enums/bucket-state.enum";

export class BucketStateUpdatedEvent {
  constructor(
    public readonly bucket: Bucket,
    public readonly oldState: BucketState,
    public readonly newState: BucketState
  ) {}
}
