import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Logger,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
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
import { InjectRedis } from "@nestjs-modules/ioredis";
import Redis from "ioredis";
import { CustomHeaders } from "../../common/constants/header.constants";
import { AuthContext } from "../../common/decorators/auth-context.decorator";
import { ContentTypeInterceptor } from "../../common/interceptors/content-type.interceptors";
import { OrganizationAuthContext } from "../../common/interfaces/auth-context.interface";
import { CombinedAuthGuard } from "../../auth/guards/auth.guard";
import { RequiredOrganizationResourcePermissions } from "../../organization/decorators/required-organization-resource-permissions.decorator";
import { OrganizationResourcePermission } from "../../organization/enums/organization-resource-permission.enum";
import { OrganizationResourceActionGuard } from "../../organization/guards/organization-resource-action.guard";
import { BucketDto } from "../dto/bucket.dto";
import { CreateBucketDto } from "../dto/create-bucket.dto";
import { BucketService } from "../services/bucket.service";

@ApiTags("buckets")
@Controller("buckets")
@ApiHeader(CustomHeaders.ORGANIZATION_ID)
@UseGuards(CombinedAuthGuard, OrganizationResourceActionGuard)
@ApiOAuth2(["openid", "profile", "email"])
@ApiBearerAuth()
export class BucketController {
  private readonly logger = new Logger(BucketController.name);

  constructor(private readonly bucketService: BucketService) {}

  @Get()
  @ApiOperation({
    summary: "List all buckets",
    operationId: "listBuckets",
  })
  @ApiResponse({
    status: 200,
    description: "List of all buckets",
    type: [BucketDto],
  })
  @ApiQuery({
    name: "includeDeleted",
    required: false,
    type: Boolean,
    description: "Include deleted buckets in the response",
  })
  @RequiredOrganizationResourcePermissions([OrganizationResourcePermission.READ_BUCKETS])
  async listBuckets(
    @AuthContext() authContext: OrganizationAuthContext,
    @Query("includeDeleted") includeDeleted = false
  ): Promise<BucketDto[]> {
    const buckets = await this.bucketService.findAll(authContext.organizationId, includeDeleted);
    return buckets.map(BucketDto.fromBucket);
  }

  @Post()
  @HttpCode(200)
  @UseInterceptors(ContentTypeInterceptor)
  @ApiOperation({
    summary: "Create a new bucket",
    operationId: "createBucket",
  })
  @ApiResponse({
    status: 200,
    description: "The bucket has been successfully created.",
    type: BucketDto,
  })
  @RequiredOrganizationResourcePermissions([OrganizationResourcePermission.WRITE_BUCKETS])
  async createBucket(
    @AuthContext() authContext: OrganizationAuthContext,
    @Body() createBucketDto: CreateBucketDto
  ): Promise<BucketDto> {
    const organization = authContext.organization;

    const bucket = await this.bucketService.create(organization, createBucketDto);
    return BucketDto.fromBucket(bucket);
  }

  @Get(":bucketId")
  @ApiOperation({
    summary: "Get bucket details",
    operationId: "getBucket",
  })
  @ApiParam({
    name: "bucketId",
    description: "ID of the bucket",
    type: "string",
  })
  @ApiResponse({
    status: 200,
    description: "Bucket details",
    type: BucketDto,
  })
  @RequiredOrganizationResourcePermissions([OrganizationResourcePermission.READ_BUCKETS])
  async getBucket(@Param("bucketId") bucketId: string): Promise<BucketDto> {
    const bucket = await this.bucketService.findOne(bucketId);
    return BucketDto.fromBucket(bucket);
  }

  @Delete(":bucketId")
  @ApiOperation({
    summary: "Delete bucket",
    operationId: "deleteBucket",
  })
  @ApiParam({
    name: "bucketId",
    description: "ID of the bucket",
    type: "string",
  })
  @ApiResponse({
    status: 200,
    description: "Bucket has been marked for deletion",
  })
  @RequiredOrganizationResourcePermissions([OrganizationResourcePermission.DELETE_BUCKETS])
  async deleteBucket(@Param("bucketId") bucketId: string): Promise<void> {
    return this.bucketService.delete(bucketId);
  }

  @Get("by-name/:name")
  @ApiOperation({
    summary: "Get bucket details by name",
    operationId: "getBucketByName",
  })
  @ApiParam({
    name: "name",
    description: "Name of the bucket",
    type: "string",
  })
  @ApiResponse({
    status: 200,
    description: "Bucket details",
    type: BucketDto,
  })
  @RequiredOrganizationResourcePermissions([OrganizationResourcePermission.READ_BUCKETS])
  async getBucketByName(
    @AuthContext() authContext: OrganizationAuthContext,
    @Param("name") name: string
  ): Promise<BucketDto> {
    const bucket = await this.bucketService.findByName(authContext.organizationId, name);
    return BucketDto.fromBucket(bucket);
  }
}
