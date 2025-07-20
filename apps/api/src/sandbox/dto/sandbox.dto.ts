import { ApiProperty, ApiPropertyOptional, ApiSchema } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { Sandbox } from "../entities/sandbox.entity";
import { BackupState } from "../enums/backup-state.enum";
import { SandboxClass } from "../enums/sandbox-class.enum";
import { SandboxDesiredState } from "../enums/sandbox-desired-state.enum";
import { SandboxState } from "../enums/sandbox-state.enum";
import { BuildInfoDto } from "./build-info.dto";

@ApiSchema({ name: "SandboxBucket" })
export class SandboxBucket {
  @ApiProperty({
    description: "The ID of the bucket",
    example: "bucket123",
  })
  bucketId: string;

  @ApiProperty({
    description: "The mount path for the bucket",
    example: "/data",
  })
  mountPath: string;
}

@ApiSchema({ name: "Sandbox" })
export class SandboxDto {
  @ApiProperty({
    description: "The ID of the sandbox",
    example: "sandbox123",
  })
  id: string;

  @ApiProperty({
    description: "The organization ID of the sandbox",
    example: "organization123",
  })
  organizationId: string;

  @ApiPropertyOptional({
    description: "The image used for the sandbox",
    example: "snapflowio/sandbox:latest",
  })
  image: string;

  @ApiProperty({
    description: "The user associated with the project",
    example: "snapflow",
  })
  user: string;

  @ApiProperty({
    description: "Environment variables for the sandbox",
    type: "object",
    additionalProperties: { type: "string" },
    example: { NODE_ENV: "production" },
  })
  env: Record<string, string>;

  @ApiProperty({
    description: "Labels for the sandbox",
    type: "object",
    additionalProperties: { type: "string" },
    example: { "snapflow.io/public": "true" },
  })
  labels: { [key: string]: string };

  @ApiProperty({
    description: "Whether the sandbox http preview is public",
    example: false,
  })
  public: boolean;

  @ApiProperty({
    description: "The target environment for the sandbox",
    example: "local",
  })
  target: string;

  @ApiProperty({
    description: "The CPU quota for the sandbox",
    example: 2,
  })
  cpu: number;

  @ApiProperty({
    description: "The GPU quota for the sandbox",
    example: 0,
  })
  gpu: number;

  @ApiProperty({
    description: "The memory quota for the sandbox",
    example: 4,
  })
  memory: number;

  @ApiProperty({
    description: "The disk quota for the sandbox",
    example: 10,
  })
  disk: number;

  @ApiPropertyOptional({
    description: "The state of the sandbox",
    enum: SandboxState,
    enumName: "SandboxState",
    example: Object.values(SandboxState)[0],
    required: false,
  })
  @IsEnum(SandboxState)
  @IsOptional()
  state?: SandboxState;

  @ApiPropertyOptional({
    description: "The desired state of the sandbox",
    enum: SandboxDesiredState,
    enumName: "SandboxDesiredState",
    example: Object.values(SandboxDesiredState)[0],
    required: false,
  })
  @IsEnum(SandboxDesiredState)
  @IsOptional()
  desiredState?: SandboxDesiredState;

  @ApiPropertyOptional({
    description: "The error reason of the sandbox",
    example: "The sandbox is not running",
    required: false,
  })
  @IsOptional()
  errorReason?: string;

  @ApiPropertyOptional({
    description: "The state of the backup",
    enum: BackupState,
    example: Object.values(BackupState)[0],
    required: false,
  })
  @IsEnum(BackupState)
  @IsOptional()
  backupState?: BackupState;

  @ApiPropertyOptional({
    description: "The creation timestamp of the last backup",
    example: "2024-10-01T12:00:00Z",
    required: false,
  })
  @IsOptional()
  backupCreatedAt?: string;

  @ApiPropertyOptional({
    description: "Auto-stop interval in minutes (0 means disabled)",
    example: 30,
    required: false,
  })
  @IsOptional()
  autoStopInterval?: number;

  @ApiPropertyOptional({
    description: "Auto-archive interval in minutes",
    example: 7 * 24 * 60,
    required: false,
  })
  @IsOptional()
  autoArchiveInterval?: number;

  @ApiPropertyOptional({
    description: "The domain name of the executor",
    example: "executor.example.com",
    required: false,
  })
  @IsOptional()
  executorDomain?: string;

  @ApiPropertyOptional({
    description: "Array of buckets attached to the sandbox",
    type: [SandboxBucket],
    required: false,
  })
  @IsOptional()
  buckets?: SandboxBucket[];

  @ApiPropertyOptional({
    description: "Build information for the sandbox",
    type: BuildInfoDto,
    required: false,
  })
  @IsOptional()
  buildInfo?: BuildInfoDto;

  @ApiPropertyOptional({
    description: "The creation timestamp of the sandbox",
    example: "2024-10-01T12:00:00Z",
    required: false,
  })
  @IsOptional()
  createdAt?: string;

  @ApiPropertyOptional({
    description: "The last update timestamp of the sandbox",
    example: "2024-10-01T12:00:00Z",
    required: false,
  })
  @IsOptional()
  updatedAt?: string;

  @ApiPropertyOptional({
    description: "The class of the sandbox",
    enum: SandboxClass,
    example: Object.values(SandboxClass)[0],
    required: false,
    deprecated: true,
  })
  @IsEnum(SandboxClass)
  @IsOptional()
  class?: SandboxClass;

  @ApiPropertyOptional({
    description: "The version of the daemon running in the sandbox",
    example: "1.0.0",
    required: false,
  })
  @IsOptional()
  daemonVersion?: string;

  static fromSandbox(sandbox: Sandbox, executorDomain: string): SandboxDto {
    return {
      id: sandbox.id,
      organizationId: sandbox.organizationId,
      target: sandbox.region,
      image: sandbox.image,
      user: sandbox.osUser,
      env: sandbox.env,
      cpu: sandbox.cpu,
      gpu: sandbox.gpu,
      memory: sandbox.mem,
      disk: sandbox.disk,
      public: sandbox.public,
      labels: sandbox.labels,
      buckets: sandbox.buckets,
      state: SandboxDto.getSandboxState(sandbox),
      desiredState: sandbox.desiredState,
      errorReason: sandbox.errorReason,
      backupState: sandbox.backupState,
      backupCreatedAt: sandbox.lastBackupAt?.toISOString(),
      autoStopInterval: sandbox.autoStopInterval,
      autoArchiveInterval: sandbox.autoArchiveInterval,
      class: sandbox.class,
      createdAt: sandbox.createdAt?.toISOString(),
      updatedAt: sandbox.updatedAt?.toISOString(),
      buildInfo: sandbox.buildInfo
        ? {
            dockerfileContent: sandbox.buildInfo.dockerfileContent,
            contextHashes: sandbox.buildInfo.contextHashes,
            createdAt: sandbox.buildInfo.createdAt,
            updatedAt: sandbox.buildInfo.updatedAt,
          }
        : undefined,
      executorDomain: executorDomain,
      daemonVersion: sandbox.daemonVersion,
    };
  }

  private static getSandboxState(sandbox: Sandbox): SandboxState {
    switch (sandbox.state) {
      case SandboxState.STARTED:
        if (sandbox.desiredState === SandboxDesiredState.STOPPED) {
          return SandboxState.STOPPING;
        }
        if (sandbox.desiredState === SandboxDesiredState.DESTROYED) {
          return SandboxState.DESTROYING;
        }
        break;
      case SandboxState.STOPPED:
        if (sandbox.desiredState === SandboxDesiredState.STARTED) {
          return SandboxState.STARTING;
        }
        if (sandbox.desiredState === SandboxDesiredState.DESTROYED) {
          return SandboxState.DESTROYING;
        }
        if (sandbox.desiredState === SandboxDesiredState.ARCHIVED) {
          return SandboxState.ARCHIVING;
        }
        break;
      case SandboxState.UNKNOWN:
        if (sandbox.desiredState === SandboxDesiredState.STARTED) {
          return SandboxState.CREATING;
        }
        break;
    }
    return sandbox.state;
  }
}

@ApiSchema({ name: "SandboxLabels" })
export class SandboxLabelsDto {
  @ApiProperty({
    description: "Key-value pairs of labels",
    example: { environment: "dev", team: "backend" },
    type: "object",
    additionalProperties: { type: "string" },
  })
  labels: { [key: string]: string };
}
