import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { IsEnum, IsNumber, IsString } from "class-validator";
import { ExecutorRegion } from "../enums/executor-region.enum";
import { SandboxClass } from "../enums/sandbox-class.enum";

@ApiSchema({ name: "CreateExecutor" })
export class CreateExecutorDto {
  @ApiProperty()
  @IsString()
  domain: string;

  @IsString()
  @ApiProperty()
  apiUrl: string;

  @IsString()
  @ApiProperty()
  proxyUrl: string;

  @IsString()
  @ApiProperty()
  apiKey: string;

  @IsNumber()
  @ApiProperty()
  cpu: number;

  @IsNumber()
  @ApiProperty()
  memory: number;

  @IsNumber()
  @ApiProperty()
  disk: number;

  @IsNumber()
  @ApiProperty()
  gpu: number;

  @IsString()
  @ApiProperty()
  gpuType: string;

  @IsEnum(SandboxClass)
  @ApiProperty({
    enum: SandboxClass,
    example: Object.values(SandboxClass)[0],
  })
  class: SandboxClass;

  @IsNumber()
  @ApiProperty()
  capacity: number;

  @IsEnum(ExecutorRegion)
  @ApiProperty({
    enum: ExecutorRegion,
    example: Object.values(ExecutorRegion)[0],
  })
  region: ExecutorRegion;

  @IsString()
  @ApiProperty()
  version: string;
}
