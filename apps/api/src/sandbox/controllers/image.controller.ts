import { IncomingMessage, ServerResponse } from "http";
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Logger,
  Next,
  NotFoundException,
  Param,
  ParseBoolPipe,
  Patch,
  Post,
  Query,
  RawBodyRequest,
  Request,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOAuth2,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { NextFunction } from "express";
import { CombinedAuthGuard } from "../../auth/guards/auth.guard";
import { SystemActionGuard } from "../../auth/guards/system-action.guard";
import { CustomHeaders } from "../../common/constants/header.constants";
import { AuthContext } from "../../common/decorators/auth-context.decorator";
import { RequiredSystemRole } from "../../common/decorators/required-role.decorator";
import { BadRequestError } from "../../common/exceptions/bad-request.exception";
import { OrganizationAuthContext } from "../../common/interfaces/auth-context.interface";
import { RequiredOrganizationResourcePermissions } from "../../organization/decorators/required-organization-resource-permissions.decorator";
import { OrganizationResourcePermission } from "../../organization/enums/organization-resource-permission.enum";
import { OrganizationResourceActionGuard } from "../../organization/guards/organization-resource-action.guard";
import { SystemRole } from "../../user/enums/system-role.enum";
import { CreateImageDto } from "../dto/create-image.dto";
import { ImageDto } from "../dto/image.dto";
import { PaginatedImagesDto } from "../dto/paginated-images.dto";
import { ToggleStateDto } from "../dto/toggle-state.dto";
import { SetImageGeneralStatusDto } from "../dto/update-image.dto";
import { Image } from "../entities/image.entity";
import { ImageAccessGuard } from "../guards/image-access.guard";
import { LogProxy } from "../proxy/log-proxy";
import { ExecutorService } from "../services/executor.service";
import { ImageService } from "../services/image.service";

@ApiTags("images")
@Controller("images")
@ApiHeader(CustomHeaders.ORGANIZATION_ID)
@UseGuards(CombinedAuthGuard, SystemActionGuard, OrganizationResourceActionGuard)
@ApiOAuth2(["openid", "profile", "email"])
@ApiBearerAuth()
export class ImageController {
  private readonly logger = new Logger(ImageController.name);

  constructor(
    private readonly imageService: ImageService,
    private readonly executorService: ExecutorService
  ) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: "Create a new image",
    operationId: "createImage",
  })
  @ApiResponse({
    status: 200,
    description: "The image has been successfully created.",
    type: ImageDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Images with tag ":latest" are not allowed',
  })
  @RequiredOrganizationResourcePermissions([OrganizationResourcePermission.WRITE_IMAGES])
  async createImage(
    @AuthContext() authContext: OrganizationAuthContext,
    @Body() createImageDto: CreateImageDto
  ): Promise<ImageDto> {
    if (createImageDto.general && authContext.role !== SystemRole.ADMIN) {
      throw new ForbiddenException("Insufficient permissions for creating general images");
    }

    if (createImageDto.buildInfo) {
      if (createImageDto.imageName) {
        throw new BadRequestError("Cannot specify an image name when using a build info entry");
      }
      if (createImageDto.entrypoint) {
        throw new BadRequestError("Cannot specify an entrypoint when using a build info entry");
      }
    } else {
      if (!createImageDto.imageName) {
        throw new BadRequestError("Must specify an image name when not using a build info entry");
      }
    }

    // TODO: consider - if using transient registry, prepend the image name with the username
    const image = await this.imageService.createImage(authContext.organization, createImageDto);
    return ImageDto.fromImage(image);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get image by ID or name",
    operationId: "getImage",
  })
  @ApiParam({
    name: "id",
    description: "Image ID or name",
  })
  @ApiResponse({
    status: 200,
    description: "The image",
    type: ImageDto,
  })
  @ApiResponse({
    status: 404,
    description: "Image not found",
  })
  @UseGuards(ImageAccessGuard)
  async getImage(
    @Param("id") imageIdOrName: string,
    @AuthContext() authContext: OrganizationAuthContext
  ): Promise<ImageDto> {
    let image: Image;
    try {
      // Try to get by ID
      image = await this.imageService.getImage(imageIdOrName);
    } catch (error) {
      // If not found by ID, try by name
      image = await this.imageService.getImageByName(imageIdOrName, authContext.organizationId);
    }
    return ImageDto.fromImage(image);
  }

  @Patch(":id/toggle")
  @ApiOperation({
    summary: "Toggle image state",
    operationId: "toggleImageState",
  })
  @ApiParam({
    name: "id",
    description: "Image ID",
  })
  @ApiResponse({
    status: 200,
    description: "Image state has been toggled",
    type: ImageDto,
  })
  @RequiredOrganizationResourcePermissions([OrganizationResourcePermission.WRITE_IMAGES])
  @UseGuards(ImageAccessGuard)
  async toggleImageState(
    @Param("id") imageId: string,
    @Body() toggleDto: ToggleStateDto
  ): Promise<ImageDto> {
    const image = await this.imageService.toggleImageState(imageId, toggleDto.enabled);
    return ImageDto.fromImage(image);
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Delete image",
    operationId: "removeImage",
  })
  @ApiParam({
    name: "id",
    description: "Image ID",
  })
  @ApiResponse({
    status: 200,
    description: "Image has been deleted",
  })
  @RequiredOrganizationResourcePermissions([OrganizationResourcePermission.DELETE_IMAGES])
  @UseGuards(ImageAccessGuard)
  async removeImage(@Param("id") imageId: string): Promise<void> {
    await this.imageService.removeImage(imageId);
  }

  @Get()
  @ApiOperation({
    summary: "List all images",
    operationId: "getAllImages",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Number of items per page",
  })
  @ApiResponse({
    status: 200,
    description: "List of all images with pagination",
    type: PaginatedImagesDto,
  })
  async getAllImages(
    @AuthContext() authContext: OrganizationAuthContext,
    @Query("page") page = 1,
    @Query("limit") limit = 10
  ): Promise<PaginatedImagesDto> {
    const result = await this.imageService.getAllImages(authContext.organizationId, page, limit);
    return {
      items: result.items.map(ImageDto.fromImage),
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }

  @Patch(":id/general")
  @ApiOperation({
    summary: "Set image general status",
    operationId: "setImageGeneralStatus",
  })
  @ApiParam({
    name: "id",
    description: "Image ID",
  })
  @ApiResponse({
    status: 200,
    description: "Image general status has been set",
    type: ImageDto,
  })
  @RequiredSystemRole(SystemRole.ADMIN)
  async setImageGeneralStatus(
    @Param("id") imageId: string,
    @Body() dto: SetImageGeneralStatusDto
  ): Promise<ImageDto> {
    const image = await this.imageService.setImageGeneralStatus(imageId, dto.general);
    return ImageDto.fromImage(image);
  }

  @Get(":id/build-logs")
  @ApiOperation({
    summary: "Get image build logs",
    operationId: "getImageBuildLogs",
  })
  @ApiParam({
    name: "id",
    description: "Image ID",
  })
  @ApiQuery({
    name: "follow",
    required: false,
    type: Boolean,
    description: "Whether to follow the logs stream",
  })
  @UseGuards(ImageAccessGuard)
  async getImageBuildLogs(
    @Request() req: RawBodyRequest<IncomingMessage>,
    @Res() res: ServerResponse,
    @Next() next: NextFunction,
    @Param("id") imageId: string,
    @Query("follow", new ParseBoolPipe({ optional: true })) follow?: boolean
  ): Promise<void> {
    let image = await this.imageService.getImage(imageId);

    // Check if the image has build info
    if (!image.buildInfo) {
      throw new NotFoundException(`Image ${imageId} has no build info`);
    }

    // Retry until a executor is assigned or timeout after 30 seconds
    const startTime = Date.now();
    const timeoutMs = 30 * 1000;

    while (!image.buildExecutorId) {
      if (Date.now() - startTime > timeoutMs) {
        throw new NotFoundException(
          `Timeout waiting for build executor assignment for image ${imageId}`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
      image = await this.imageService.getImage(imageId);
    }

    const executor = await this.executorService.findOne(image.buildExecutorId);
    if (!executor) {
      throw new NotFoundException(`Build executor for image ${imageId} not found`);
    }

    const logProxy = new LogProxy(
      executor.apiUrl,
      image.buildInfo.imageRef,
      executor.apiKey,
      follow === true,
      req,
      res,
      next
    );
    return logProxy.create();
  }

  @Post(":id/activate")
  @HttpCode(200)
  @ApiOperation({
    summary: "Activate a image",
    operationId: "activateImage",
  })
  @ApiParam({
    name: "id",
    description: "Image ID",
  })
  @ApiResponse({
    status: 200,
    description: "The image has been successfully activated.",
    type: ImageDto,
  })
  @ApiResponse({
    status: 400,
    description:
      "Bad request - Image is already active, not in inactive state, or has associated image executors",
  })
  @ApiResponse({
    status: 404,
    description: "Image not found",
  })
  @RequiredOrganizationResourcePermissions([OrganizationResourcePermission.WRITE_IMAGES])
  @UseGuards(ImageAccessGuard)
  async activateImage(@Param("id") imageId: string): Promise<ImageDto> {
    const image = await this.imageService.activateImage(imageId);
    return ImageDto.fromImage(image);
  }
}
