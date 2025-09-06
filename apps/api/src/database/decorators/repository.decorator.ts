import "reflect-metadata";

import { Injectable, Type } from "@nestjs/common";

// Metadata keys
const REPOSITORY_ENTITY_KEY = Symbol("REPOSITORY_ENTITY");
const REPOSITORY_OPTIONS_KEY = Symbol("REPOSITORY_OPTIONS");

/**
 * Repository options interface
 */
export interface RepositoryOptions {
  /** Custom entity name for token generation */
  entity?: string;
  /** Custom token name */
  token?: string;
  /** Whether to register as singleton (default: true) */
  singleton?: boolean;
}

/**
 * Repository decorator that automatically generates tokens
 *
 * @param entityOrOptions - Entity name or repository options
 * @returns Class decorator
 *
 * @example
 * ```typescript
 * @Repository('User')
 * export class UserRepository extends BaseRepository {
 *   // ...
 * }
 *
 * @Repository({ entity: 'User', singleton: true })
 * export class UserRepository extends BaseRepository {
 *   // ...
 * }
 * ```
 */
export function Repository(entityOrOptions?: string | RepositoryOptions): ClassDecorator {
  return (target: any) => {
    // Apply Injectable decorator
    Injectable()(target);

    // Parse options
    const options: RepositoryOptions =
      typeof entityOrOptions === "string"
        ? { entity: entityOrOptions }
        : { singleton: true, ...entityOrOptions };

    // Determine entity name
    const entityName = options.entity || target.name.replace(/Repository$/, "") || "Unknown";

    // Store metadata
    Reflect.defineMetadata(REPOSITORY_ENTITY_KEY, entityName, target);
    Reflect.defineMetadata(REPOSITORY_OPTIONS_KEY, options, target);

    return target;
  };
}

/**
 * Get the repository token for a given repository class or entity name
 *
 * @param repository - Repository class, entity name, or constructor function
 * @returns Token string
 */
export function getRepositoryToken(repository: Type<any> | string): string {
  if (typeof repository === "string") {
    return `${repository.toUpperCase()}_REPOSITORY`;
  }

  // Try to get custom token first
  const options = Reflect.getMetadata(REPOSITORY_OPTIONS_KEY, repository) as RepositoryOptions;
  if (options?.token) {
    return options.token;
  }

  // Get entity name from metadata or class name
  const entityName =
    Reflect.getMetadata(REPOSITORY_ENTITY_KEY, repository) ||
    (typeof repository === "function" ? repository.name.replace(/Repository$/, "") : "Unknown");

  return `${entityName.toUpperCase()}_REPOSITORY`;
}

/**
 * Get repository metadata
 */
export function getRepositoryMetadata(repository: Type<any>): {
  entity: string;
  options: RepositoryOptions;
} {
  const entity = Reflect.getMetadata(REPOSITORY_ENTITY_KEY, repository) || "Unknown";
  const options = Reflect.getMetadata(REPOSITORY_OPTIONS_KEY, repository) || {};

  return { entity, options };
}
