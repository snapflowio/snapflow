import { join } from "path";
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { ServeStaticModule } from "@nestjs/serve-static";
import { ThrottlerModule } from "@nestjs/throttler";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RedisModule } from "@nestjs-modules/ioredis";
import { ApiKeyModule } from "./api-key/api-key-module";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { MaintenanceMiddleware } from "./common/middleware/maintenance.middleware";
import { VersionHeaderMiddleware } from "./common/middleware/version-header.middleware";
import { CustomNamingStrategy } from "./common/utils/naming-strategy.util";
import { TypedConfigModule } from "./config/typed-config.module";
import { TypedConfigService } from "./config/typed-config.service";
import { DockerRegistryModule } from "./docker-registry/docker-registry.module";
import { SandboxModule } from "./sandbox/sandbox.module";
import { TeamModule } from "./team/team.module";
import { UsageModule } from "./usage/usage.module";
import { UserModule } from "./user/user.module";

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
      rootPath: join(__dirname, "..", "dashboard"),
      exclude: ["/api/*"],
      renderPath: "/",
      serveStaticOptions: {
        cacheControl: false,
      },
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
    EventEmitterModule.forRoot(),
    AuthModule,
    ApiKeyModule,
    DockerRegistryModule,
    SandboxModule,
    TeamModule,
    UsageModule,
    UserModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(VersionHeaderMiddleware).forRoutes({ path: "*", method: RequestMethod.ALL });
    consumer.apply(MaintenanceMiddleware).forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}
