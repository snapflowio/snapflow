import {
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CombinedAuthGuard } from "../auth/guards/combined-auth.guard";
import { SystemActionGuard } from "../auth/guards/system-action.guard";
import { AuthContext } from "../common/decorators/auth-context.decorator";
import { RequiredSystemRole } from "../common/decorators/required-role.decorator";
import { AuthContext as IAuthContext } from "../common/interfaces/auth-context.interface";
import { CreateUserDto } from "./dto/create-user.dto";
import { UserDto } from "./dto/user.dto";
import { SystemRole } from "./enums/system-role.enum";
import { User } from "./user.entity";
import { UserService } from "./user.service";

@ApiTags("users")
@Controller("users")
@UseGuards(CombinedAuthGuard, SystemActionGuard)
@ApiBearerAuth()
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  @Get("/me")
  @ApiOperation({
    summary: "Get authenticated user",
    operationId: "getAuthenticatedUser",
  })
  @ApiResponse({
    status: 200,
    description: "User details",
    type: UserDto,
  })
  async getAuthenticatedUser(
    @AuthContext() authContext: IAuthContext,
  ): Promise<UserDto> {
    const user = await this.userService.findOne(authContext.userId);
    if (!user)
      throw new NotFoundException(
        `User with ID ${authContext.userId} not found`,
      );

    return UserDto.fromUser(user);
  }

  @Post()
  @ApiOperation({
    summary: "Create user",
    operationId: "createUser",
  })
  @RequiredSystemRole(SystemRole.ADMIN)
  async create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.userService.create(createUserDto);
  }

  @Get()
  @ApiOperation({
    summary: "List all users",
    operationId: "listUsers",
  })
  @RequiredSystemRole(SystemRole.ADMIN)
  async findAll(): Promise<User[]> {
    return this.userService.findAll();
  }

  @Get("/:id")
  @ApiOperation({
    summary: "Get user by ID",
    operationId: "getUser",
  })
  @ApiResponse({
    status: 200,
    description: "User details",
    type: UserDto,
  })
  @RequiredSystemRole(SystemRole.ADMIN)
  async getUserById(@Param("id") id: string): Promise<UserDto> {
    const user = await this.userService.findOne(id);
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);

    return UserDto.fromUser(user);
  }
}
