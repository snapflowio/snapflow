import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CombinedAuthGuard } from "../auth/guards/combined-auth.guard";
import { CustomHeaders } from "../common/constants/header.constants";
import { AuthContext } from "../common/decorators/auth-context.decorator";
import { OrganizationAuthContext } from "../common/interfaces/auth-context.interface";
import { OrganizationMemberRole } from "../organization/enums/organization-member-role.enum";
import { OrganizationResourcePermission } from "../organization/enums/organization-resource-permission.enum";
import { OrganizationResourceActionGuard } from "../organization/guards/organization-resource-action.guard";
import { SystemRole } from "../user/enums/system-role.enum";
import { ApiKeyService } from "./api-key.service";
import { ApiKeyResponseDto } from "./dto/api-key-response.dto";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";

@ApiTags("api-keys")
@Controller("api-keys")
@ApiHeader(CustomHeaders.ORGANIZATION_ID)
@UseGuards(CombinedAuthGuard, OrganizationResourceActionGuard)
@ApiBearerAuth()
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @ApiOperation({
    summary: "Create an API key",
    operationId: "createApiKey",
  })
  @ApiResponse({
    status: 201,
    description: "API key created successfully",
    type: ApiKeyResponseDto,
  })
  async createApiKey(
    @AuthContext() authContext: OrganizationAuthContext,
    @Body() createApiKeyDto: CreateApiKeyDto,
  ): Promise<ApiKeyResponseDto> {
    this.validateRequestedApiKeyPermissions(
      authContext,
      createApiKeyDto.permissions,
    );

    const { apiKey, key } = await this.apiKeyService.createApiKey(
      authContext.organizationId,
      authContext.userId,
      createApiKeyDto.name,
      createApiKeyDto.permissions,
      createApiKeyDto.expiresAt,
    );

    return ApiKeyResponseDto.fromApiKey(apiKey, key);
  }

  private validateRequestedApiKeyPermissions(
    authContext: OrganizationAuthContext,
    requestedPermissions: OrganizationResourcePermission[],
  ): void {
    if (authContext.role === SystemRole.ADMIN) return;

    if (!authContext.organizationUser)
      throw new ForbiddenException(
        `Insufficient permissions for assigning: ${requestedPermissions.join(", ")}`,
      );

    if (authContext.organizationUser.role === OrganizationMemberRole.OWNER)
      return;

    const organizationUserPermissions = new Set(
      authContext.organizationUser.assignedRoles.flatMap(
        (role) => role.permissions,
      ),
    );

    const forbiddenPermissions = requestedPermissions.filter(
      (permission) => !organizationUserPermissions.has(permission),
    );

    if (forbiddenPermissions.length)
      throw new ForbiddenException(
        `Insufficient permissions for assigning: ${forbiddenPermissions.join(", ")}`,
      );
  }
}
