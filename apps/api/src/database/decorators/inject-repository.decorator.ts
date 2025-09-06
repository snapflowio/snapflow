import { Inject, Type } from "@nestjs/common";

import { getRepositoryToken } from "./repository.decorator";

/**
 * Repository injection decorator - TypeORM/MikroORM style
 *
 * @param repository - The repository class or entity name
 * @returns Parameter decorator for dependency injection
 *
 * @example
 * ```typescript
 * constructor(
 *   @InjectRepository(UserRepository)
 *   private userRepo: UserRepository
 * ) {}
 * ```
 */
export function InjectRepository<T = any>(repository: Type<T> | string): ParameterDecorator {
  const token = getRepositoryToken(repository);
  return Inject(token);
}

/**
 * Database service injection decorator
 *
 * @example
 * ```typescript
 * constructor(
 *   @InjectDb()
 *   private db: DatabaseService
 * ) {}
 * ```
 */
export function InjectDb(): ParameterDecorator {
  return Inject("DATABASE_SERVICE");
}

/**
 * Database connection injection decorator
 * Injects the raw Drizzle database connection
 *
 * @example
 * ```typescript
 * constructor(
 *   @InjectConnection()
 *   private connection: Database
 * ) {}
 * ```
 */
export function InjectConnection(): ParameterDecorator {
  return Inject("DATABASE_CONNECTION");
}

// Re-export for convenience
export { getRepositoryToken } from "./repository.decorator";
