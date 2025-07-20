import {
  CreateBucketCommand,
  ListBucketsCommand,
  PutBucketTaggingCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { InjectRedis } from "@nestjs-modules/ioredis";
import { Redis } from "ioredis";
import { In, Repository } from "typeorm";
import { deleteS3Bucket } from "../../common/utils/delete-s3-bucket";
import { TypedConfigService } from "../../config/typed-config.service";
import { RedisLockProvider } from "../common/redis-lock.provider";
import { Bucket } from "../entities/bucket.entity";
import { BucketState } from "../enums/bucket-state.enum";

const VOLUME_STATE_LOCK_KEY = "bucket-state-";

@Injectable()
export class BucketManager implements OnModuleInit {
  private readonly logger = new Logger(BucketManager.name);
  private processingBuckets: Set<string> = new Set();
  private skipTestConnection: boolean;
  private s3Client: S3Client;

  constructor(
    @InjectRepository(Bucket)
    private readonly bucketRepository: Repository<Bucket>,
    private readonly configService: TypedConfigService,
    @InjectRedis() private readonly redis: Redis,
    private readonly redisLockProvider: RedisLockProvider
  ) {
    const endpoint = this.configService.getOrThrow("s3.endpoint");
    const region = this.configService.getOrThrow("s3.region");
    const accessKeyId = this.configService.getOrThrow("s3.accessKey");
    const secretAccessKey = this.configService.getOrThrow("s3.secretKey");
    this.skipTestConnection = this.configService.get("skipConnections");

    this.s3Client = new S3Client({
      endpoint: endpoint.startsWith("https") ? endpoint : `https://${endpoint}`,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  async onModuleInit() {
    if (this.skipTestConnection) {
      this.logger.debug("Skipping S3 connection test");
      return;
    }

    await this.testConnection();
  }

  private async testConnection() {
    try {
      await this.s3Client.send(new ListBucketsCommand({}));
      this.logger.debug("Successfully connected to S3");
    } catch (error) {
      this.logger.error("Failed to connect to S3:", error);
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async processPendingBuckets() {
    try {
      // Lock the entire process
      const lockKey = "process-pending-buckets";
      if (!(await this.redisLockProvider.lock(lockKey, 30))) {
        return;
      }

      const pendingBuckets = await this.bucketRepository.find({
        where: {
          state: In([BucketState.PENDING_CREATE, BucketState.PENDING_DELETE]),
        },
      });

      await Promise.all(
        pendingBuckets.map(async (bucket) => {
          if (this.processingBuckets.has(bucket.id)) return;

          const bucketLockKey = `${VOLUME_STATE_LOCK_KEY}${bucket.id}`;
          const acquired = await this.redisLockProvider.lock(bucketLockKey, 30);
          if (!acquired) {
            return;
          }

          try {
            this.processingBuckets.add(bucket.id);
            await this.processBucketState(bucket);
          } finally {
            this.processingBuckets.delete(bucket.id);
            await this.redisLockProvider.unlock(bucketLockKey);
          }
        })
      );

      await this.redisLockProvider.unlock(lockKey);
    } catch (error) {
      this.logger.error("Error processing pending buckets:", error);
    }
  }

  private async processBucketState(bucket: Bucket): Promise<void> {
    const bucketLockKey = `${VOLUME_STATE_LOCK_KEY}${bucket.id}`;

    try {
      switch (bucket.state) {
        case BucketState.PENDING_CREATE:
          await this.handlePendingCreate(bucket, bucketLockKey);
          break;
        case BucketState.PENDING_DELETE:
          await this.handlePendingDelete(bucket, bucketLockKey);
          break;
      }
    } catch (error) {
      this.logger.error(`Error processing bucket ${bucket.id}:`, error);
      await this.bucketRepository.update(bucket.id, {
        state: BucketState.ERROR,
        errorReason: error.message,
      });
    }
  }

  private async handlePendingCreate(bucket: Bucket, lockKey: string): Promise<void> {
    try {
      await this.redis.setex(lockKey, 30, "1");

      await this.bucketRepository.save({
        ...bucket,
        state: BucketState.CREATING,
      });

      await this.redis.setex(lockKey, 30, "1");

      const createBucketCommand = new CreateBucketCommand({
        Bucket: bucket.getBucketName(),
      });

      await this.s3Client.send(createBucketCommand);

      await this.s3Client.send(
        new PutBucketTaggingCommand({
          Bucket: bucket.getBucketName(),
          Tagging: {
            TagSet: [
              {
                Key: "BucketId",
                Value: bucket.id,
              },
              {
                Key: "OrganizationId",
                Value: bucket.organizationId,
              },
              {
                Key: "Environment",
                Value: this.configService.get("environment"),
              },
            ],
          },
        })
      );

      await this.redis.setex(lockKey, 30, "1");

      await this.bucketRepository.save({
        ...bucket,
        state: BucketState.READY,
      });
      this.logger.debug(`Bucket ${bucket.id} created successfully`);
    } catch (error) {
      this.logger.error(`Error creating bucket ${bucket.id}:`, error);
      await this.bucketRepository.save({
        ...bucket,
        state: BucketState.ERROR,
        errorReason: error.message,
      });
    }
  }

  private async handlePendingDelete(bucket: Bucket, lockKey: string): Promise<void> {
    try {
      await this.redis.setex(lockKey, 30, "1");

      await this.bucketRepository.save({
        ...bucket,
        state: BucketState.DELETING,
      });

      await this.redis.setex(lockKey, 30, "1");

      await deleteS3Bucket(this.s3Client, bucket.getBucketName());

      await this.redis.setex(lockKey, 30, "1");

      await this.bucketRepository.delete({
        organizationId: bucket.organizationId,
        name: `${bucket.name}-deleted`,
        state: BucketState.DELETED,
      });

      await this.bucketRepository.save({
        ...bucket,
        state: BucketState.DELETED,
        name: `${bucket.name}-deleted`,
      });
      this.logger.debug(`Bucket ${bucket.id} deleted successfully`);
    } catch (error) {
      this.logger.error(`Error deleting bucket ${bucket.id}:`, error);
      await this.bucketRepository.save({
        ...bucket,
        state: BucketState.ERROR,
        errorReason: error.message,
      });
    }
  }
}
