import { Body, Controller, Get, Logger, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOAuth2, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CombinedAuthGuard } from "../auth/guards/auth.guard";
import { SystemActionGuard } from "../auth/guards/system-action.guard";
import { AuthContext } from "../common/decorators/auth-context.decorator";
import { RequiredSystemRole } from "../common/decorators/required-role.decorator";
import { AuthContext as IAuthContext } from "../common/interfaces/auth-context.interface";
import { CreateUserDto } from "./dto/create-user.dto";
import { UserDto } from "./dto/user.dto";
import { SystemRole } from "./enums/system-role.enum";
import { User } from "./user.entity";
import { UserService } from "./user.service";

/**
 * API controller for managing users.
 * All endpoints are protected and require authentication.
 */
@ApiTags("users")
@Controller("users")
@UseGuards(CombinedAuthGuard, SystemActionGuard)
@ApiOAuth2(["openid", "profile", "email"])
@ApiBearerAuth()
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  /**
   * Retrieves the profile of the currently authenticated user.
   * @param authContext - The authentication context of the current user.
   * @returns A promise that resolves to the user's data transfer object.
   * @throws {NotFoundException} If the authenticated user cannot be found.
   */
  @Get("/me")
  @ApiOperation({
    summary: "Get authenticated user",
    operationId: "getAuthenticatedUser",
  })
  @ApiResponse({
    status: 200,
    description: "The details of the authenticated user.",
    type: UserDto,
  })
  async getAuthenticatedUser(@AuthContext() authContext: IAuthContext): Promise<UserDto> {
    try {
      const user = await this.userService.findOneOrFail(authContext.userId);
      return UserDto.fromUser(user);
    } catch (error) {
      this.logger.error(`Failed to find authenticated user with ID ${authContext.userId}`);
      // Re-throw the original error (which should be NotFoundException from the service)
      throw error;
    }
  }

  /**
   * Creates a new user.
   * Requires ADMIN privileges.
   * @param createUserDto - The data for creating the new user.
   * @returns A promise that resolves to the newly created user entity.
   */
  @Post()
  @ApiOperation({
    summary: "Create a new user",
    operationId: "createUser",
  })
  @ApiResponse({
    status: 201,
    description: "The user has been successfully created.",
    type: UserDto,
  })
  @RequiredSystemRole(SystemRole.ADMIN)
  async create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.userService.create(createUserDto);
  }

  /**
   * Retrieves a list of all users.
   * Requires ADMIN privileges.
   * @returns A promise that resolves to an array of all user entities.
   */
  @Get()
  @ApiOperation({
    summary: "List all users",
    operationId: "listUsers",
  })
  @ApiResponse({
    status: 200,
    description: "An array of all users.",
    type: [UserDto],
  })
  @RequiredSystemRole(SystemRole.ADMIN)
  async findAll(): Promise<User[]> {
    return this.userService.findAll();
  }

  /**
   * Retrieves a single user by their ID.
   * Requires ADMIN privileges.
   * @param id - The ID of the user to retrieve.
   * @returns A promise that resolves to the user's data transfer object.
   * @throws {NotFoundException} If the user with the specified ID is not found.
   */
  @Get("/:id")
  @ApiOperation({
    summary: "Get a user by ID",
    operationId: "getUser",
  })
  @ApiResponse({
    status: 200,
    description: "The details of the user.",
    type: UserDto,
  })
  @RequiredSystemRole(SystemRole.ADMIN)
  async getUserById(@Param("id") id: string): Promise<UserDto> {
    try {
      const user = await this.userService.findOneOrFail(id);
      return UserDto.fromUser(user);
    } catch (error) {
      this.logger.error(`Failed to find user with ID ${id}`);
      // Re-throw the original error
      throw error;
    }
  }
}
