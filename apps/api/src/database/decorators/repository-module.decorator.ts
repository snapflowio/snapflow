import { DynamicModule, Type } from "@nestjs/common";

import { getRepositoryMetadata, getRepositoryToken } from "./repository.decorator";

/**
 * Repository module helper - automatically registers repositories like TypeORM
 *
 * @param repositories - Array of repository classes to register
 * @returns Providers array for NestJS module
 *
 * @example
 * ```typescript
 * @Module({
 *   providers: [
 *     ...createRepositoryProviders([UserRepository, PostRepository])
 *   ]
 * })
 * export class MyModule {}
 * ```
 */
export function createRepositoryProviders(repositories: Type<any>[]): any[] {
  return repositories.flatMap((repository) => {
    const token = getRepositoryToken(repository);
    const { options } = getRepositoryMetadata(repository);

    return [
      repository,
      {
        provide: token,
        useExisting: repository,
        scope: options.singleton === false ? "TRANSIENT" : "DEFAULT",
      },
    ];
  });
}

/**
 * Repository feature module - TypeORM style forFeature
 *
 * @param repositories - Repository classes to register
 * @returns Dynamic module
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [RepositoryModule.forFeature([UserRepository, PostRepository])]
 * })
 * export class UserModule {}
 * ```
 */

// biome-ignore lint/complexity/noStaticOnlyClass: needed for repository registry
export class RepositoryModule {
  static forFeature(repositories: Type<any>[]): DynamicModule {
    const providers = createRepositoryProviders(repositories);

    return {
      module: RepositoryModule,
      providers,
      exports: providers,
    };
  }
}

/**
 * Get all repository tokens from an array of repository classes
 */
export function getRepositoryTokens(repositories: Type<any>[]): string[] {
  return repositories.map((repo) => getRepositoryToken(repo));
}
