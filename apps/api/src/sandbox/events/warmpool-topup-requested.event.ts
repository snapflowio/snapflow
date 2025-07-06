import { WarmPool } from "../entities/warm-pool.entity";

export class WarmPoolTopUpRequested {
  constructor(public readonly warmPool: WarmPool) {}
}
