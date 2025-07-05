import { EntityManager } from "typeorm";

export class UserDeletedEvent {
  constructor(
    public readonly entityManager: EntityManager,
    public readonly userId: string,
  ) {}
}
