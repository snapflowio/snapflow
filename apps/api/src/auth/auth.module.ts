import { HttpModule, HttpService } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { OidcMetadata } from "oidc-client-ts";
import { firstValueFrom } from "rxjs";
import { catchError, map } from "rxjs/operators";
import { ApiKeyModule } from "../api-key/api-key.module";
import { TypedConfigModule } from "../config/typed-config.module";
import { TypedConfigService } from "../config/typed-config.service";
import { UserModule } from "../user/user.module";
import { UserService } from "../user/user.service";
import { ApiKeyStrategy } from "./strategies/api-key.strategy";
import { JwtStrategy } from "./strategies/jwt.strategy";

@Module({
  imports: [
    PassportModule.register({
      defaultStrategy: ["jwt", "api-key"],
      property: "user",
      session: false,
    }),
    TypedConfigModule,
    UserModule,
    ApiKeyModule,
    HttpModule,
  ],
  providers: [
    ApiKeyStrategy,
    {
      provide: JwtStrategy,
      useFactory: async (
        userService: UserService,
        httpService: HttpService,
        configService: TypedConfigService,
      ) => {
        const discoveryUrl = `${configService.get("oidc.issuer")}/.well-known/openid-configuration`;
        const metadata = await firstValueFrom(
          httpService.get(discoveryUrl).pipe(
            map((response) => response.data as OidcMetadata),
            catchError((error) => {
              throw new Error(
                `Failed to fetch OpenID configuration: ${error.message}`,
              );
            }),
          ),
        );

        return new JwtStrategy(
          {
            audience: configService.get("oidc.audience"),
            issuer: metadata.issuer,
            jwksUri: metadata.jwks_uri,
          },
          userService,
        );
      },
      inject: [UserService, HttpService, TypedConfigService],
    },
  ],
  exports: [PassportModule, JwtStrategy, ApiKeyStrategy],
})
export class AuthModule {}
