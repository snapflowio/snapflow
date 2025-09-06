import { RedisModule } from "@nestjs-modules/ioredis";
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { ServeStaticModule } from "@nestjs/serve-static";
import { ThrottlerModule } from "@nestjs/throttler";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { haveIBeenPwned } from "better-auth/plugins";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { AuthModule } from "../auth/auth.module";
import { AuthGuard } from "../auth/guards/auth.guard";
import { MaintenanceMiddleware } from "../common/middleware/maintenance.middleware";
import { TypedConfigModule } from "../config/typed-config.module";
import { TypedConfigService } from "../config/typed-config.service";
import { DatabaseModule } from "../database/database.module";
import { DatabaseService } from "../database/database.service";
import * as schema from "../database/schema";
import { HealthModule } from "../health/health.module";
import { UserModule } from "../user/user.module";
import { WorkspaceModule } from "../workspace/workspace.module";
import { AppService } from "./app.service";

@Module({
  imports: [
    TypedConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, "..", "website"),
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
          },
        };
      },
    }),
    AuthModule.forRootAsync({
      useFactory: (databaseService: DatabaseService, configService: TypedConfigService) => ({
        auth: betterAuth({
          baseURL: configService.getOrThrow("betterAuth.baseUrl"),
          secret: configService.getOrThrow("betterAuth.secret"),
          trustedOrigins: ["http://localhost:3000"],
          database: drizzleAdapter(databaseService.db, {
            provider: "pg",
            schema,
          }),
          user: {
            changeEmail: {
              enabled: true,
            },
          },
          emailAndPassword: {
            enabled: true,
            autoSignIn: true,
            maxPasswordLength: 32,
            minPasswordLength: 8,
          },
          advanced: {
            cookiePrefix: "snapflow",
            database: {
              generateId: () => uuidv4(),
            },
          },
          telemetry: {
            enabled: false,
          },
          plugins: [haveIBeenPwned()],
        }),
      }),
      inject: [DatabaseService, TypedConfigService],
    }),
    HealthModule,
    UserModule,
    WorkspaceModule,
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
  ],
  controllers: [],
  providers: [AuthGuard, AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MaintenanceMiddleware).forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}
