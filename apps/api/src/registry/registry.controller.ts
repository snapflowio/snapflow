import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOAuth2,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CombinedAuthGuard } from "../auth/guards/auth.guard";
import { CustomHeaders } from "../common/constants/header.constants";
import { AuthContext } from "../common/decorators/auth-context.decorator";
import { OrganizationAuthContext } from "../common/interfaces/auth-context.interface";
import { RequiredOrganizationResourcePermissions } from "../organization/decorators/required-organization-resource-permissions.decorator";
import { OrganizationResourcePermission } from "../organization/enums/organization-resource-permission.enum";
import { OrganizationResourceActionGuard } from "../organization/guards/organization-resource-action.guard";
import { RegistryPushAccessDto } from "../sandbox/dto/registry-push-access.dto";
import { DockerRegistry } from "./decorators/registry.decorator";
import { CreateDockerRegistryDto } from "./dto/create-registry.dto";
import { RegistryDto } from "./dto/registry.dto";
import { UpdateRegistryDto } from "./dto/update-registry.dto";
import { Registry as RegistryEntity } from "./entities/registry.entity";
import { RegistryAccessGuard } from "./guards/registry-access.guard";
import { RegistryService } from "./registry.service";

@ApiTags("registry")
@Controller("registry")
@ApiHeader(CustomHeaders.ORGANIZATION_ID)
@UseGuards(CombinedAuthGuard, OrganizationResourceActionGuard)
@ApiOAuth2(["openid", "profile", "email"])
@ApiBearerAuth()
export class DockerRegistryController {
  constructor(private readonly registryService: RegistryService) {}

  @Post()
  @ApiOperation({
    summary: "Create registry",
    operationId: "createRegistry",
  })
  @ApiResponse({
    status: 201,
    description: "The registry has been successfully created.",
    type: RegistryDto,
  })
  @RequiredOrganizationResourcePermissions([OrganizationResourcePermission.WRITE_REGISTRIES])
  create(
    @AuthContext() authContext: OrganizationAuthContext,
    @Body() createDockerRegistryDto: CreateDockerRegistryDto
  ): Promise<RegistryDto> {
    return this.registryService.create(createDockerRegistryDto, authContext.organizationId);
  }

  @Get()
  @ApiOperation({
    summary: "List registries",
    operationId: "listRegistries",
  })
  @ApiResponse({
    status: 200,
    description: "List of all container registries",
    type: [RegistryDto],
  })
  findAll(@AuthContext() authContext: OrganizationAuthContext): Promise<RegistryDto[]> {
    return this.registryService.findAll(authContext.organizationId);
  }

  @Get("registry-push-access")
  @HttpCode(200)
  @ApiOperation({
    summary: "Get temporary registry access for pushing images",
    operationId: "getTransientPushAccess",
  })
  @ApiResponse({
    status: 200,
    description: "Temporary registry access has been generated",
    type: RegistryPushAccessDto,
  })
  @RequiredOrganizationResourcePermissions([OrganizationResourcePermission.WRITE_REGISTRIES])
  async getTransientPushAccess(
    @AuthContext() authContext: OrganizationAuthContext
  ): Promise<RegistryPushAccessDto> {
    return this.registryService.getRegistryPushAccess(
      authContext.organizationId,
      authContext.userId
    );
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get registry",
    operationId: "getRegistry",
  })
  @ApiParam({
    name: "id",
    description: "ID of the registry",
    type: "string",
  })
  @ApiResponse({
    status: 200,
    description: "The container registry",
    type: RegistryDto,
  })
  @UseGuards(RegistryAccessGuard)
  async findOne(@DockerRegistry() registry: RegistryEntity): Promise<RegistryDto> {
    return registry;
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update registry",
    operationId: "updateRegistry",
  })
  @ApiParam({
    name: "id",
    description: "ID of the docker registry",
    type: "string",
  })
  @ApiResponse({
    status: 200,
    description: "The container registry has been successfully updated.",
    type: RegistryDto,
  })
  @RequiredOrganizationResourcePermissions([OrganizationResourcePermission.WRITE_REGISTRIES])
  @UseGuards(RegistryAccessGuard)
  async update(
    @Param("id") registryId: string,
    @Body() updateRegistryDto: UpdateRegistryDto
  ): Promise<RegistryDto> {
    return this.registryService.update(registryId, updateRegistryDto);
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Delete registry",
    operationId: "deleteRegistry",
  })
  @ApiParam({
    name: "id",
    description: "ID of the container registry",
    type: "string",
  })
  @ApiResponse({
    status: 204,
    description: "The container registry has been successfully deleted.",
  })
  @HttpCode(204)
  @RequiredOrganizationResourcePermissions([OrganizationResourcePermission.DELETE_REGISTRIES])
  @UseGuards(RegistryAccessGuard)
  async remove(@Param("id") registryId: string): Promise<void> {
    return this.registryService.remove(registryId);
  }

  @Post(":id/set-default")
  @ApiOperation({
    summary: "Set default registry",
    operationId: "setDefaultRegistry",
  })
  @ApiParam({
    name: "id",
    description: "ID of the container registry",
    type: "string",
  })
  @ApiResponse({
    status: 200,
    description: "The container registry has been set as default.",
    type: RegistryDto,
  })
  @RequiredOrganizationResourcePermissions([OrganizationResourcePermission.WRITE_REGISTRIES])
  @UseGuards(RegistryAccessGuard)
  async setDefault(@Param("id") registryId: string): Promise<RegistryDto> {
    return this.registryService.setDefault(registryId);
  }
}
