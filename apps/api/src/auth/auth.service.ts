import { createSecretKey } from "crypto";
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import argon2 from "argon2";
import { SignJWT } from "jose";
import { v4 as uuidv4 } from "uuid";
import { DEFAULT_ORGANIZATION_QUOTA } from "../common/constants/quota.constants";
import { TypedConfigService } from "../config/typed-config.service";
import { SystemRole } from "../user/enums/system-role.enum";
import { User } from "../user/user.entity";
import { UserService } from "../user/user.service";
import { SignUp } from "./dto/sign-up.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly configService: TypedConfigService,
  ) {}

  async signup(signUp: SignUp): Promise<{ user: User; token: string }> {
    const existingUser = await this.userService.findOneByEmail(signUp.email);
    if (existingUser)
      throw new ConflictException("The email is already registered.");

    const hashedPassword = await this.hashPassword(signUp.password);

    const user = await this.userService.create({
      id: uuidv4(),
      name: signUp.name,
      password: hashedPassword,
      email: signUp.email,
      emailVerified: false,
      role: SystemRole.USER,
      personalOrganizationQuota: DEFAULT_ORGANIZATION_QUOTA,
    });

    const token = await this.createJwt(user.id);

    return { user, token };
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ user: User; token: string }> {
    const user = await this.userService.findOneByEmail(email);
    if (!user) throw new UnauthorizedException("Invalid login details");

    const passwordValid = await this.checkPassword(password, user.password);
    if (!passwordValid)
      throw new UnauthorizedException("Invalid login details");

    if ("password" in user) user.password = undefined;

    const token = await this.createJwt(user.id);

    return { user, token };
  }

  private async createJwt(userId: string): Promise<string> {
    const secretKey = createSecretKey(
      this.configService.get("jwtSecretKey"),
      "utf-8",
    );

    const token = await new SignJWT({ id: userId })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setIssuer("Snapflow")
      .setExpirationTime("30d")
      .sign(secretKey);

    return token;
  }

  private async checkPassword(
    rawPassword: string,
    passwordHash: string,
  ): Promise<boolean> {
    const passwordCorrect = await argon2.verify(passwordHash, rawPassword);
    return passwordCorrect;
  }

  private async hashPassword(rawPassword: string): Promise<string> {
    const hash = await argon2.hash(rawPassword);
    return hash;
  }
}
