import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
import { RedisModule } from "@nestjs-modules/ioredis";
import { McpModule, McpTransportType } from "@rekog/mcp-nest";
import { ApiKeyModule } from "../api-key/api-key.module";
import { MaintenanceMiddleware } from "../common/middleware/maintenance.middleware";
import { VersionHeaderMiddleware } from "../common/middleware/version-header.middleware";
import { TypedConfigModule } from "../config/typed-config.module";
import { TypedConfigService } from "../config/typed-config.service";
import { OrganizationModule } from "../organization/organization.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { DockerRegistryModule } from "../registry/registry.module";
import { SandboxModule } from "../sandbox/sandbox.module";
import { UsageModule } from "../usage/usage.module";
import { UserModule } from "../user/user.module";
import { WebhookModule } from "../webhooks/webhook.module";
import { AppService } from "./app.service";
import { AppTool } from "./app.tool";

@Module({
  imports: [
    TypedConfigModule.forRoot({
      isGlobal: true,
    }),
    McpModule.forRoot({
      name: "snapflow",
      version: "0.0.1",
      transport: McpTransportType.STREAMABLE_HTTP,
      guards: [],
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
    ApiKeyModule,
    DockerRegistryModule,
    OrganizationModule,
    SandboxModule,
    RealtimeModule,
    UsageModule,
    UserModule,
    WebhookModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [],
  providers: [AppService, AppTool],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(VersionHeaderMiddleware).forRoutes({ path: "*", method: RequestMethod.ALL });
    consumer.apply(MaintenanceMiddleware).forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}
