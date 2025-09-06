import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { config } from "./config";

/**
 * A type alias representing the structure of the application's configuration.
 * It's derived from the actual config object to ensure type safety.
 */
type Configuration = typeof config;

/**
 * A utility type to generate all possible dot-notation paths for a nested object.
 * This is used to provide strong typing and autocompletion for configuration keys.
 * @template T The object type to generate paths from.
 *
 * @example
 * type MyConfig = { app: { port: number }, db: { host: string } };
 * type MyConfigPaths = Paths<MyConfig>; // "app" | "app.port" | "db" | "db.host"
 */
type Paths<T> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? `${K}` | `${K}.${Paths<T[K]>}`
          : `${K}`
        : never;
    }[keyof T]
  : never;

/**
 * A utility type that retrieves the type of a value at a given path in a nested object.
 * @template T The object type to retrieve a value from.
 * @template P The dot-notation path to the value.
 */
type PathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? T[K] extends object
      ? PathValue<T[K], Rest>
      : never
    : never
  : P extends keyof T
    ? T[P]
    : never;

/**
 * A type-safe wrapper around NestJS's `ConfigService`.
 *
 * This service provides methods to access configuration variables with full
 * TypeScript type safety and autocompletion, based on the structure of
 * the `config.ts` file.
 */
@Injectable()
export class TypedConfigService {
  /**
   * Injects the underlying NestJS `ConfigService`.
   * @param {ConfigService} configService The core NestJS configuration service.
   */
  constructor(private readonly configService: ConfigService) {}

  /**
   * Retrieves a configuration value by its key.
   * The key is a type-safe, dot-notation path to the desired value.
   *
   * @template K A string literal type representing a valid path in the configuration.
   * @param {K} key The dot-notation key of the configuration value.
   * @returns {PathValue<Configuration, K>} The value of the configuration property.
   */
  get<K extends Paths<Configuration>>(key: K): PathValue<Configuration, K> {
    // The underlying `get` from NestJS is of type `any`, but our wrappers
    // ensure that the return type is correctly inferred.
    return this.configService.get(key);
  }

  /**
   * Retrieves a configuration value by its key and throws an error if it is null or undefined.
   * This is useful for required configuration values that must be present at runtime.
   *
   * @template K A string literal type representing a valid path in the configuration.
   * @param {K} key The dot-notation key of the configuration value.
   * @returns {NonNullable<PathValue<Configuration, K>>} The non-nullable value.
   * @throws {Error} If the configuration value is null or undefined.
   */
  getOrThrow<K extends Paths<Configuration>>(key: K): NonNullable<PathValue<Configuration, K>> {
    const value = this.get(key);

    // Ensure that required configuration values are present.
    if (value === null || value === undefined) {
      throw new Error(`Configuration key "${key}" is missing or undefined.`);
    }

    return value as NonNullable<PathValue<Configuration, K>>;
  }
}
