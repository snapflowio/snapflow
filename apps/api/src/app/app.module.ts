import { join } from "path";
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { ServeStaticModule } from "@nestjs/serve-static";
import { ThrottlerModule } from "@nestjs/throttler";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RedisModule } from "@nestjs-modules/ioredis";
import { McpModule, McpTransportType } from "@rekog/mcp-nest";
import { ApiKeyModule } from "../api-key/api-key.module";
import { AuthModule } from "../auth/auth.module";
import { CombinedAuthGuard } from "../auth/guards/auth.guard";
import { MaintenanceMiddleware } from "../common/middleware/maintenance.middleware";
import { VersionHeaderMiddleware } from "../common/middleware/version-header.middleware";
import { CustomNamingStrategy } from "../common/utils/naming-strategy.util";
import { TypedConfigModule } from "../config/typed-config.module";
import { TypedConfigService } from "../config/typed-config.service";
import { OrganizationModule } from "../organization/organization.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { DockerRegistryModule } from "../registry/registry.module";
import { SandboxModule } from "../sandbox/sandbox.module";
import { UsageModule } from "../usage/usage.module";
import { UserModule } from "../user/user.module";
import { AppService } from "./app.service";
import { AppTool } from "./app.tool";

@Module({
  imports: [
    TypedConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [TypedConfigService],
      useFactory: (configService: TypedConfigService) => {
        return {
          type: "postgres",
          host: configService.getOrThrow("database.host"),
          port: configService.getOrThrow("database.port"),
          username: configService.getOrThrow("database.username"),
          password: configService.getOrThrow("database.password"),
          database: configService.getOrThrow("database.database"),
          autoLoadEntities: true,
          migrations: [join(__dirname, "migrations/**/*{.ts,.js}")],
          migrationsRun: !configService.getOrThrow("production"),
          namingStrategy: new CustomNamingStrategy(),
          manualInitialization: configService.get("skipConnections"),
        };
      },
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, "..", "website"),
      exclude: ["/api/*"],
      renderPath: "/",
      serveStaticOptions: {
        cacheControl: false,
      },
    }),
    McpModule.forRoot({
      name: "snapflow",
      version: "0.0.1",
      transport: McpTransportType.STREAMABLE_HTTP,
      guards: [CombinedAuthGuard],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 1000,
        limit: 10,
      },
    ]),
    RedisModule.forRootAsync({
      inject: [TypedConfigService],
      useFactory: (configService: TypedConfigService) => {
        return {
          type: "single",
          options: {
            host: configService.getOrThrow("redis.host"),
            port: configService.getOrThrow("redis.port"),
            tls: configService.get("redis.tls"),
            lazyConnect: configService.get("skipConnections"),
          },
        };
      },
    }),
    McpModule.forRoot({
      name: "snapflow-mcp",
      version: "0.0.1",
    }),
    EventEmitterModule.forRoot(),
    AuthModule,
    ApiKeyModule,
    DockerRegistryModule,
    OrganizationModule,
    SandboxModule,
    RealtimeModule,
    UsageModule,
    UserModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [],
  providers: [CombinedAuthGuard, AppService, AppTool],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(VersionHeaderMiddleware).forRoutes({ path: "*", method: RequestMethod.ALL });
    consumer.apply(MaintenanceMiddleware).forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}
