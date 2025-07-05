import { createSecretKey } from "crypto";
import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Request } from "express";
import { JWTPayload, jwtVerify } from "jose";
import { ExtractJwt, Strategy } from "passport-jwt";
import { CustomHeaders } from "../../common/constants/header.constants";
import { AuthContext } from "../../common/interfaces/auth-context.interface";
import { UserService } from "../../user/user.service";

interface JwtStrategyConfig {
  secret: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly options: JwtStrategyConfig,
    private readonly userService: UserService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: options.secret,
      issuer: "Snapflow",
      algorithms: ["HS256"],
      passReqToCallback: true,
    });

    this.logger.debug("JwtStrategy initialized");
  }

  async validate(request: Request, payload: any): Promise<AuthContext> {
    const userId = payload.sub;
    const user = await this.userService.findOne(userId);

    if (user && !user.emailVerified && payload.email_verified)
      await this.userService.updateEmailVerified(
        user.id,
        payload.email_verified,
      );

    if (!user) throw new UnauthorizedException("Invalid user");

    if (user.name === "Unknown" || !user.email) {
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
    const secretKey = createSecretKey(this.options.secret, "utf-8");
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: "Snapflow",
      algorithms: ["HS256"],
    });

    return payload;
  }
}
