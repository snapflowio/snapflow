import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOAuth2,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CombinedAuthGuard } from "../auth/guards/auth.guard";
import { CustomHeaders } from "../common/constants/header.constants";
import { AuthContext } from "../common/decorators/auth-context.decorator";
import {
  AuthContext as IAuthContext,
  OrganizationAuthContext,
} from "../common/interfaces/auth-context.interface";
import { OrganizationMemberRole } from "../organization/enums/organization-member-role.enum";
import { OrganizationResourcePermission } from "../organization/enums/organization-resource-permission.enum";
import { OrganizationResourceActionGuard } from "../organization/guards/organization-resource-action.guard";
import { SystemRole } from "../user/enums/system-role.enum";
import { ApiKeyService } from "./api-key.service";
import { ApiKeyListDto } from "./dto/api-key-list.dto";
import { ApiKeyResponseDto } from "./dto/api-key-response.dto";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";

/**
 * Controller for managing API keys within an organization.
 * All endpoints require authentication and an organization context.
 */
@ApiTags("api-keys")
@Controller("api-keys")
@ApiHeader(CustomHeaders.ORGANIZATION_ID)
@UseGuards(CombinedAuthGuard, OrganizationResourceActionGuard)
@ApiOAuth2(["openid", "profile", "email"])
@ApiBearerAuth()
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  /**
   * Creates a new API key for the authenticated user's organization.
   * The permissions granted to the key cannot exceed the creator's own permissions.
   * @param authContext - The authentication context of the requesting user.
   * @param createApiKeyDto - The data for creating the new API key.
   * @returns The newly created API key, including the raw key value.
   */
  @Post()
  @ApiOperation({
    summary: "Create API key",
    operationId: "createApiKey",
  })
  @ApiResponse({
    status: 201,
    description: "API key created successfully.",
    type: ApiKeyResponseDto,
  })
  async createApiKey(
    @AuthContext() authContext: OrganizationAuthContext,
    @Body() createApiKeyDto: CreateApiKeyDto
  ): Promise<ApiKeyResponseDto> {
    this.validateRequestedApiKeyPermissions(authContext, createApiKeyDto.permissions);

    const { apiKey, key } = await this.apiKeyService.createApiKey(
      authContext.organizationId,
      authContext.userId,
      createApiKeyDto.name,
      createApiKeyDto.permissions,
      createApiKeyDto.expiresAt
    );

    return ApiKeyResponseDto.fromApiKey(apiKey, key);
  }

  /**
   * Lists all API keys for the authenticated user in the current organization.
   * @param authContext - The authentication context of the requesting user.
   * @returns An array of API key details, without the raw key values.
   */
  @Get()
  @ApiOperation({
    summary: "List API keys",
    operationId: "listApiKeys",
  })
  @ApiResponse({
    status: 200,
    description: "API keys retrieved successfully.",
    type: [ApiKeyListDto],
  })
  async getApiKeys(@AuthContext() authContext: OrganizationAuthContext): Promise<ApiKeyListDto[]> {
    const apiKeys = await this.apiKeyService.getApiKeys(
      authContext.organizationId,
      authContext.userId
    );
    return apiKeys.map(ApiKeyListDto.fromApiKey);
  }

  /**
   * Gets details for the API key currently being used for authentication.
   * This endpoint is only usable when authenticating with an API key.
   * @param authContext - The authentication context, which must include API key details.
   * @returns The details of the current API key.
   * @throws {ForbiddenException} If the endpoint is not accessed with an API key.
   */
  @Get("current")
  @ApiOperation({
    summary: "Get current API key's details",
    operationId: "getCurrentApiKey",
  })
  @ApiResponse({
    status: 200,
    description: "API key retrieved successfully.",
    type: ApiKeyListDto,
  })
  async getCurrentApiKey(@AuthContext() authContext: IAuthContext): Promise<ApiKeyListDto> {
    if (!authContext.apiKey) {
      throw new ForbiddenException("Authenticate with an API key to use this endpoint.");
    }

    return ApiKeyListDto.fromApiKey(authContext.apiKey);
  }

  /**
   * Retrieves a specific API key by its name.
   * @param authContext - The authentication context of the requesting user.
   * @param name - The name of the API key to retrieve.
   * @returns The details of the specified API key.
   */
  @Get(":name")
  @ApiOperation({
    summary: "Get API key by name",
    operationId: "getApiKey",
  })
  @ApiResponse({
    status: 200,
    description: "API key retrieved successfully.",
    type: ApiKeyListDto,
  })
  async getApiKey(
    @AuthContext() authContext: OrganizationAuthContext,
    @Param("name") name: string
  ): Promise<ApiKeyListDto> {
    const apiKey = await this.apiKeyService.getApiKeyByName(
      authContext.organizationId,
      authContext.userId,
      name
    );
    return ApiKeyListDto.fromApiKey(apiKey);
  }

  /**
   * Deletes a specific API key by its name.
   * @param authContext - The authentication context of the requesting user.
   * @param name - The name of the API key to delete.
   */
  @Delete(":name")
  @ApiOperation({
    summary: "Delete API key by name",
    operationId: "deleteApiKey",
  })
  @ApiResponse({ status: 204, description: "API key deleted successfully." })
  @HttpCode(204)
  async deleteApiKey(
    @AuthContext() authContext: OrganizationAuthContext,
    @Param("name") name: string
  ): Promise<void> {
    await this.apiKeyService.deleteApiKey(authContext.organizationId, authContext.userId, name);
  }

  /**
   * Validates if the requesting user has the authority to create an API key
   * with the specified permissions.
   * @param authContext - The user's authentication context.
   * @param requestedPermissions - The list of permissions for the new key.
   * @throws {ForbiddenException} If the user lacks the necessary permissions to assign.
   */
  private validateRequestedApiKeyPermissions(
    authContext: OrganizationAuthContext,
    requestedPermissions: OrganizationResourcePermission[]
  ): void {
    // System admins can grant any permission.
    if (authContext.role === SystemRole.ADMIN) {
      return;
    }

    if (!authContext.organizationUser) {
      throw new ForbiddenException("User context within organization not found.");
    }

    // Organization owners can grant any permission.
    if (authContext.organizationUser.role === OrganizationMemberRole.OWNER) {
      return;
    }

    const organizationUserPermissions = new Set(
      authContext.organizationUser.assignedRoles.flatMap((role) => role.permissions)
    );

    const forbiddenPermissions = requestedPermissions.filter(
      (permission) => !organizationUserPermissions.has(permission)
    );

    if (forbiddenPermissions.length) {
      throw new ForbiddenException(
        `Insufficient permissions for assigning: ${forbiddenPermissions.join(", ")}`
      );
    }
  }
}
