import { Database } from "../../database/repositories/base.repository";

export class UserDeletedEvent {
  constructor(
    public readonly db: Database,
    public readonly userId: string
  ) {}
}
