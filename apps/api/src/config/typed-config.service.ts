import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { config } from "./config";

type Configuration = typeof config;

type Paths<T> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? `${K}` | `${K}.${Paths<T[K]>}`
          : `${K}`
        : never;
    }[keyof T]
  : never;

type PathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? T[K] extends object
      ? PathValue<T[K], Rest>
      : never
    : never
  : P extends keyof T
    ? T[P]
    : never;

@Injectable()
export class TypedConfigService {
  constructor(private configService: ConfigService) {}

  get<K extends Paths<Configuration>>(key: K): PathValue<Configuration, K> {
    return this.configService.get(key);
  }

  getOrThrow<K extends Paths<Configuration>>(
    key: K,
  ): NonNullable<PathValue<Configuration, K>> {
    const value = this.get(key);
    if (value === undefined)
      throw new Error(`Configuration key "${key}" is undefined`);
    return value as NonNullable<PathValue<Configuration, K>>;
  }
}
