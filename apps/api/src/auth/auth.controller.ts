import { Body, Controller, Post, Res } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { UserDto } from "../user/dto/user.dto";
import { User } from "../user/user.entity";
import { AuthService } from "./auth.service";
import { Login } from "./dto/login.dto";
import { SignUp } from "./dto/sign-up.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("/login")
  @ApiOperation({
    summary: "Login a user",
    operationId: "login",
  })
  @ApiResponse({
    status: 200,
    description: "User info",
    type: UserDto,
  })
  async login(
    @Body() login: Login,
    @Res({ passthrough: true }) res: Response,
  ): Promise<User> {
    const loginUser = await this.authService.login(login.email, login.password);
    res.cookie("token", loginUser.token, { httpOnly: true });

    return loginUser.user;
  }

  @Post("signup")
  @ApiOperation({
    summary: "Create a user account",
    operationId: "signup",
  })
  @ApiResponse({
    status: 201,
    description: "User info",
    type: UserDto,
  })
  async signup(
    @Body() signup: SignUp,
    @Res({ passthrough: true }) res: Response,
  ): Promise<User> {
    const signupUser = await this.authService.signup(signup);
    res.cookie("token", signupUser.token, { httpOnly: true });

    return signupUser.user;
  }
}
