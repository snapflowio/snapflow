import { DynamicModule, Global, Module } from "@nestjs/common";
import {
  ConfigModuleOptions,
  ConfigModule as NestConfigModule,
} from "@nestjs/config";
import { config } from "./config";
import { TypedConfigService } from "./typed-config.service";

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [() => config],
    }),
  ],
  providers: [TypedConfigService],
  exports: [TypedConfigService],
})

// biome-ignore lint/complexity/noStaticOnlyClass: ignore
export class TypedConfigModule {
  static forRoot(options: Partial<ConfigModuleOptions> = {}): DynamicModule {
    return {
      module: TypedConfigModule,
      imports: [
        NestConfigModule.forRoot({
          ...options,
        }),
      ],
      providers: [TypedConfigService],
      exports: [TypedConfigService],
    };
  }
}
