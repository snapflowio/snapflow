import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Not, Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { BadRequestError } from "../../common/exceptions/bad-request.exception";
import { Organization } from "../../organization/entities/organization.entity";
import { SandboxEvents } from "../constants/sandbox-events.constants";
import { CreateBucketDto } from "../dto/create-bucket.dto";
import { Bucket } from "../entities/bucket.entity";
import { BucketState } from "../enums/bucket-state.enum";
import { SandboxCreatedEvent } from "../events/sandbox-create.event";

@Injectable()
export class BucketService {
  private readonly logger = new Logger(BucketService.name);

  constructor(
    @InjectRepository(Bucket)
    private readonly bucketRepository: Repository<Bucket>
  ) {}

  async create(organization: Organization, createBucketDto: CreateBucketDto): Promise<Bucket> {
    // Validate quota
    const activeBucketCount = await this.countActive(organization.id);

    if (activeBucketCount >= organization.bucketQuota) {
      throw new ForbiddenException(`Bucket quota limit (${organization.bucketQuota}) reached`);
    }

    const bucket = new Bucket();

    // Generate ID
    bucket.id = uuidv4();

    // Set name from DTO or use ID as default
    bucket.name = createBucketDto.name || bucket.id;

    // Check if bucket with same name already exists for organization
    const existingBucket = await this.bucketRepository.findOne({
      where: {
        organizationId: organization.id,
        name: bucket.name,
        state: Not(BucketState.DELETED),
      },
    });

    if (existingBucket) {
      throw new BadRequestError(`Bucket with name ${bucket.name} already exists`);
    }

    bucket.organizationId = organization.id;
    bucket.state = BucketState.PENDING_CREATE;

    const savedBucket = await this.bucketRepository.save(bucket);
    this.logger.debug(`Created bucket ${savedBucket.id} for organization ${organization.id}`);
    return savedBucket;
  }

  async delete(bucketId: string): Promise<void> {
    const bucket = await this.bucketRepository.findOne({
      where: {
        id: bucketId,
      },
    });

    if (!bucket) {
      throw new NotFoundException(`Bucket with ID ${bucketId} not found`);
    }

    if (bucket.state !== BucketState.READY) {
      throw new BadRequestError(
        `Bucket must be in '${BucketState.READY}' state in order to be deleted`
      );
    }

    // Update state to mark as deleting
    bucket.state = BucketState.PENDING_DELETE;
    await this.bucketRepository.save(bucket);
    this.logger.debug(`Marked bucket ${bucketId} for deletion`);
  }

  async findOne(bucketId: string): Promise<Bucket> {
    const bucket = await this.bucketRepository.findOne({
      where: { id: bucketId },
    });

    if (!bucket) {
      throw new NotFoundException(`Bucket with ID ${bucketId} not found`);
    }

    return bucket;
  }

  async findAll(organizationId: string, includeDeleted = false): Promise<Bucket[]> {
    return this.bucketRepository.find({
      where: {
        organizationId,
        ...(includeDeleted ? {} : { state: Not(BucketState.DELETED) }),
      },
      order: {
        lastUsedAt: {
          direction: "DESC",
          nulls: "LAST",
        },
        createdAt: "DESC",
      },
    });
  }

  async findByName(organizationId: string, name: string): Promise<Bucket> {
    const bucket = await this.bucketRepository.findOne({
      where: {
        organizationId,
        name,
        state: Not(BucketState.DELETED),
      },
    });

    if (!bucket) {
      throw new NotFoundException(`Bucket with name ${name} not found`);
    }

    return bucket;
  }

  async countActive(organizationId: string): Promise<number> {
    return this.bucketRepository.count({
      where: {
        organizationId,
        state: Not(In([BucketState.DELETED, BucketState.ERROR])),
      },
    });
  }

  @OnEvent(SandboxEvents.CREATED)
  private async handleSandboxCreatedEvent(event: SandboxCreatedEvent) {
    if (!event.sandbox.buckets.length) {
      return;
    }

    try {
      const bucketIds = event.sandbox.buckets.map((vol) => vol.bucketId);
      const buckets = await this.bucketRepository.find({
        where: { id: In(bucketIds) },
      });

      const results = await Promise.allSettled(
        buckets.map((bucket) => {
          bucket.lastUsedAt = event.sandbox.createdAt;
          return this.bucketRepository.save(bucket);
        })
      );

      results.forEach((result) => {
        if (result.status === "rejected") {
          this.logger.error(
            `Failed to update bucket lastUsedAt timestamp for sandbox ${event.sandbox.id}: ${result.reason}`
          );
        }
      });
    } catch (err) {
      this.logger.error(err);
    }
  }
}
