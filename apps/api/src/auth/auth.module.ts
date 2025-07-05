import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ApiKeyModule } from "../api-key/api-key-module";
import { TypedConfigModule } from "../config/typed-config.module";
import { TypedConfigService } from "../config/typed-config.service";
import { User } from "../user/user.entity";
import { UserModule } from "../user/user.module";
import { UserService } from "../user/user.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { ApiKeyStrategy } from "./strategies/api-key.strategy";
import { JwtStrategy } from "./strategies/jwt.strategy";

@Module({
  imports: [
    UserModule,
    ApiKeyModule,
    TypedConfigModule,
    HttpModule,
    PassportModule.register({
      defaultStrategy: ["jwt", "api-key"],
      session: false,
    }),
    TypeOrmModule.forFeature([User]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    ApiKeyStrategy,
    {
      provide: JwtStrategy,
      useFactory: async (
        userService: UserService,
        configService: TypedConfigService,
      ) => {
        return new JwtStrategy(
          {
            secret: configService.get("jwtSecretKey"),
          },
          userService,
        );
      },
      inject: [UserService, TypedConfigService],
    },
  ],
  exports: [AuthService, PassportModule, JwtStrategy, ApiKeyStrategy],
})
export class AuthModule {}
