import { ApiProperty, ApiPropertyOptional, ApiSchema } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { Executor } from "../entities/executor.entity";
import { ExecutorRegion } from "../enums/executor-region.enum";
import { ExecutorState } from "../enums/executor-state.enum";
import { SandboxClass } from "../enums/sandbox-class.enum";

@ApiSchema({ name: "Executor" })
export class ExecutorDto {
  @ApiProperty({
    description: "The ID of the executor",
    example: "executor123",
  })
  id: string;

  @ApiProperty({
    description: "The domain of the executor",
    example: "executor1.example.com",
  })
  domain: string;

  @ApiProperty({
    description: "The API URL of the executor",
    example: "https://api.executor1.example.com",
  })
  apiUrl: string;

  @ApiProperty({
    description: "The proxy URL of the runner",
    example: "https://proxy.runner1.example.com",
  })
  proxyUrl: string;

  @ApiProperty({
    description: "The API key for the executor",
    example: "api-key-123",
  })
  apiKey: string;

  @ApiProperty({
    description: "The CPU capacity of the executor",
    example: 8,
  })
  cpu: number;

  @ApiProperty({
    description: "The memory capacity of the executor in GB",
    example: 16,
  })
  memory: number;

  @ApiProperty({
    description: "The disk capacity of the executor in GB",
    example: 100,
  })
  disk: number;

  @ApiProperty({
    description: "The GPU capacity of the executor",
    example: 1,
  })
  gpu: number;

  @ApiProperty({
    description: "The type of GPU",
  })
  gpuType: string;

  @ApiProperty({
    description: "The class of the executor",
    enum: SandboxClass,
    enumName: "SandboxClass",
    example: SandboxClass.SMALL,
  })
  @IsEnum(SandboxClass)
  class: SandboxClass;

  @ApiProperty({
    description: "The current usage of the executor",
    example: 2,
  })
  used: number;

  @ApiProperty({
    description: "The capacity of the executor",
    example: 10,
  })
  capacity: number;

  @ApiProperty({
    description: "The region of the executor",
    enum: ExecutorRegion,
    enumName: "ExecutorRegion",
    example: ExecutorRegion.EU,
  })
  @IsEnum(ExecutorRegion)
  region: ExecutorRegion;

  @ApiProperty({
    description: "The state of the executor",
    enum: ExecutorState,
    enumName: "ExecutorState",
    example: ExecutorState.INITIALIZING,
  })
  @IsEnum(ExecutorState)
  state: ExecutorState;

  @ApiPropertyOptional({
    description: "The last time the executor was checked",
    example: "2024-10-01T12:00:00Z",
    required: false,
  })
  @IsOptional()
  lastChecked?: string;

  @ApiProperty({
    description: "Whether the executor is unschedulable",
    example: false,
  })
  unschedulable: boolean;

  @ApiProperty({
    description: "The creation timestamp of the executor",
    example: "2023-10-01T12:00:00Z",
  })
  createdAt: string;

  @ApiProperty({
    description: "The last update timestamp of the executor",
    example: "2023-10-01T12:00:00Z",
  })
  updatedAt: string;

  @ApiProperty({
    description: "The version of the runner",
    example: "0",
  })
  version: string;

  static fromExecutor(executor: Executor): ExecutorDto {
    return {
      id: executor.id,
      domain: executor.domain,
      apiUrl: executor.apiUrl,
      apiKey: executor.apiKey,
      proxyUrl: executor.proxyUrl,
      cpu: executor.cpu,
      memory: executor.memory,
      disk: executor.disk,
      gpu: executor.gpu,
      gpuType: executor.gpuType,
      class: executor.class,
      used: executor.used,
      capacity: executor.capacity,
      region: executor.region,
      state: executor.state,
      lastChecked: executor.lastChecked?.toISOString(),
      unschedulable: executor.unschedulable,
      createdAt: executor.createdAt.toISOString(),
      updatedAt: executor.updatedAt.toISOString(),
      version: executor.version,
    };
  }
}
