import { Injectable, Logger } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Request } from "express";
import { createRemoteJWKSet, JWTPayload, jwtVerify } from "jose";
import { passportJwtSecret } from "jwks-rsa";
import { ExtractJwt, Strategy } from "passport-jwt";
import { CustomHeaders } from "../../common/constants/header.constants";
import { DEFAULT_ORGANIZATION_QUOTA } from "../../common/constants/quota.constants";
import { AuthContext } from "../../common/interfaces/auth-context.interface";
import { UserService } from "../../user/user.service";

interface JwtStrategyConfig {
  jwksUri: string;
  audience: string;
  issuer: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);
  private JWKS: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly options: JwtStrategyConfig,
    private readonly userService: UserService,
  ) {
    super({
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: options.jwksUri,
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience: options.audience,
      issuer: options.issuer,
      algorithms: ["RS256"],
      passReqToCallback: true,
    });

    this.JWKS = createRemoteJWKSet(new URL(options.jwksUri));
    this.logger.debug("JwtStrategy initialized");
  }

  async validate(request: Request, payload: any): Promise<AuthContext> {
    const userId = payload.sub;
    let user = await this.userService.findOne(userId);

    if (user && !user.emailVerified && payload.email_verified)
      await this.userService.updateEmailVerified(
        user.id,
        payload.email_verified,
      );

    if (!user) {
      user = await this.userService.create({
        id: userId,
        name: payload.name || payload.username || "Unknown",
        email: payload.email || "",
        emailVerified: payload.email_verified || false,
        personalOrganizationQuota: DEFAULT_ORGANIZATION_QUOTA,
      });

      this.logger.debug(`Created new user with ID: ${userId}`);
    } else if (user.name === "Unknown" || !user.email) {
      await this.userService.updateName(
        user.id,
        payload.name || payload.username || "Unknown",
      );
      await this.userService.updateEmail(user.id, payload.email || "");

      this.logger.debug(
        `Updated name and email address for existing user with ID: ${userId}`,
      );
    }

    const organizationId = request.get(CustomHeaders.ORGANIZATION_ID.name);

    return {
      userId: user.id,
      role: user.role,
      email: user.email,
      organizationId,
    };
  }

  async verifyToken(token: string): Promise<JWTPayload> {
    const { payload } = await jwtVerify(token, this.JWKS, {
      audience: this.options.audience,
      issuer: this.options.issuer,
      algorithms: ["RS256"],
    });

    return payload;
  }
}
