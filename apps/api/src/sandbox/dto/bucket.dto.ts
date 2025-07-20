import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { Bucket } from "../entities/bucket.entity";
import { BucketState } from "../enums/bucket-state.enum";

export class BucketDto {
  @ApiProperty({
    description: "Bucket ID",
    example: "vol-12345678",
  })
  id: string;

  @ApiProperty({
    description: "Bucket name",
    example: "my-bucket",
  })
  name: string;

  @ApiProperty({
    description: "Organization ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  organizationId: string;

  @ApiProperty({
    description: "Bucket state",
    enum: BucketState,
    enumName: "BucketState",
    example: BucketState.READY,
  })
  @IsEnum(BucketState)
  state: BucketState;

  @ApiProperty({
    description: "Creation timestamp",
    example: "2023-01-01T00:00:00.000Z",
  })
  createdAt: string;

  @ApiProperty({
    description: "Last update timestamp",
    example: "2023-01-01T00:00:00.000Z",
  })
  updatedAt: string;

  @ApiPropertyOptional({
    description: "Last used timestamp",
    example: "2023-01-01T00:00:00.000Z",
    nullable: true,
  })
  lastUsedAt?: string;

  @ApiProperty({
    description: "The error reason of the bucket",
    example: "Error processing bucket",
    nullable: true,
  })
  errorReason?: string;

  static fromBucket(bucket: Bucket): BucketDto {
    return {
      id: bucket.id,
      name: bucket.name,
      organizationId: bucket.organizationId,
      state: bucket.state,
      createdAt: bucket.createdAt?.toISOString(),
      updatedAt: bucket.updatedAt?.toISOString(),
      lastUsedAt: bucket.lastUsedAt?.toISOString(),
      errorReason: bucket.errorReason,
    };
  }
}
