import { Controller, Get, Logger, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Session } from "../auth/decorators/session.decorator";
import type { UserSession } from "../auth/guards/auth.guard";
import { AuthGuard } from "../auth/guards/auth.guard";
import { UserDto } from "./dto/user.dto";
import { UserService } from "./user.service";

/**
 * API controller for managing users.
 * All endpoints are protected and require authentication.
 */
@ApiTags("users")
@Controller("users")
@UseGuards(AuthGuard)
@ApiCookieAuth()
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
  async getAuthenticatedUser(@Session() session: UserSession): Promise<UserDto> {
    try {
      const user = await this.userService.findOneOrFail(session.user.id);
      return UserDto.fromUser(user);
    } catch (error) {
      this.logger.error(`Failed to find authenticated user with ID ${session.user.id}`);
      // Re-throw the original error (which should be NotFoundException from the service)
      throw error;
    }
  }
}
