import { DynamicModule, Global, Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule, ConfigModuleOptions } from "@nestjs/config";

import { config } from "./config";
import { TypedConfigService } from "./typed-config.service";

/**
 * A global module for providing type-safe configuration throughout the application.
 *
 * This module should be imported into the root `AppModule` using the
 * static `forRoot()` method.
 *
 * @example
 * ```ts
 * // In app.module.ts
 *
 * import { Module } from '@nestjs/common';
 * import { TypedConfigModule } from './config/typed-config.module';
 *
 * @Module({
 * imports: [
 * // Use forRoot() to initialize the module
 * TypedConfigModule.forRoot(),
 * ],
 * })
 * export class AppModule {}
 * ```
 */
@Global()
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Kept as requested by user.
export class TypedConfigModule {
  /**
   * Initializes and configures the type-safe configuration module.
   *
   * This method sets up the underlying NestJS `ConfigModule` and makes the
   * `TypedConfigService` available for dependency injection across the application.
   *
   * @param {ConfigModuleOptions} options - Optional `ConfigModuleOptions` from `@nestjs/config`
   * to customize the behavior. These are merged with the default settings.
   *
   * @returns {DynamicModule} The configured dynamic module instance.
   */
  static forRoot(options: ConfigModuleOptions = {}): DynamicModule {
    return {
      module: TypedConfigModule,
      imports: [
        // Configure the underlying NestJS ConfigModule.
        NestConfigModule.forRoot({
          // Default options can be overridden by the user.
          isGlobal: true,
          load: [() => config],
          ...options,
        }),
      ],
      providers: [TypedConfigService],
      exports: [TypedConfigService],
    };
  }
}
