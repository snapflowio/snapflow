import { Injectable } from "@nestjs/common";
import { Context, Tool } from "@rekog/mcp-nest";
import { z } from "zod";
import { OrganizationService } from "../../organization/services/organization.service";
import { BucketDto } from "../dto/bucket.dto";
import { BucketService } from "../services/bucket.service";

@Injectable()
export class BucketTool {
  constructor(
    private readonly bucketService: BucketService,
    private readonly organizationService: OrganizationService
  ) {}

  @Tool({
    name: "create-bucket",
    description: "Creates one bucket for an organization",
    parameters: z.object({
      name: z.string().describe("The name of the bucket that is being created"),
    }),
  })
  async createBucket({ name }, context: Context, request: Request) {
    const organization = await this.organizationService.findOne(request.user.organizationId);

    const bucket = await this.bucketService.create(organization, {
      name,
    });

    return BucketDto.fromBucket(bucket);
  }

  @Tool({
    name: "get-bucket",
    description: "Gets the details of a bucket",
    parameters: z.object({
      bucketId: z.string().uuid().describe("The ID of the bucket to get details from"),
    }),
  })
  async getBucket({ bucketId }, context: Context, request: Request) {
    const bucket = await this.bucketService.findOne(bucketId);
    return BucketDto.fromBucket(bucket);
  }

  @Tool({
    name: "list-buckets",
    description: "Lists all the buckets under a users organization",
    parameters: z.object({
      includeDeleted: z.boolean().describe("Whether or not to include deleted buckets"),
    }),
  })
  async listBuckets({ includeDeleted }, context: Context, request: Request) {
    const buckets = await this.bucketService.findAll(request.user.organizationId, includeDeleted);
    return buckets.map(BucketDto.fromBucket);
  }

  @Tool({
    name: "delete-bucket",
    description: "Deletes a bucket",
    parameters: z.object({
      bucketId: z.string().uuid().describe("The ID of the bucket to delete"),
    }),
  })
  async deleteBucket({ bucketId }) {
    await this.bucketService.delete(bucketId);
    return {
      bucketId,
    };
  }
}
