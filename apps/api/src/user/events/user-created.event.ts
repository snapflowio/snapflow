import { Database } from "../../database/repositories/base.repository";

export class UserCreatedEvent {
  constructor(
    public readonly db: Database,
    public readonly userId: string,
    public readonly email?: string,
    public readonly emailVerified?: boolean
  ) {}
}
