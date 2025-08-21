import { EntityManager } from "typeorm";

export class UserEmailVerifiedEvent {
  constructor(
    public readonly entityManager: EntityManager,
    public readonly userId: string
  ) {}
}
