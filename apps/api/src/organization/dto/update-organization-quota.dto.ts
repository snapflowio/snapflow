import { ApiProperty, ApiSchema } from "@nestjs/swagger";

@ApiSchema({ name: "UpdateOrganizationQuota" })
export class UpdateOrganizationQuotaDto {
  @ApiProperty({ nullable: true })
  totalCpuQuota?: number;

  @ApiProperty({ nullable: true })
  totalMemoryQuota?: number;

  @ApiProperty({ nullable: true })
  totalDiskQuota?: number;

  @ApiProperty({ nullable: true })
  maxCpuPerSandbox?: number;

  @ApiProperty({ nullable: true })
  maxMemoryPerSandbox?: number;

  @ApiProperty({ nullable: true })
  maxDiskPerSandbox?: number;

  @ApiProperty({ nullable: true })
  imageQuota?: number;

  @ApiProperty({ nullable: true })
  maxImageSize?: number;

  @ApiProperty({ nullable: true })
  bucketQuota?: number;
}
