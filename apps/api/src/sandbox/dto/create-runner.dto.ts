import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { IsEnum, IsNumber, IsString } from "class-validator";
import { RunnerRegion } from "../enums/runner-region.enum";
import { SandboxClass } from "../enums/sandbox-class.enum";

@ApiSchema({ name: "CreateRunner" })
export class CreateRunnerDto {
  @ApiProperty()
  @IsString()
  domain: string;

  @IsString()
  @ApiProperty()
  apiUrl: string;

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

  @IsEnum(RunnerRegion)
  @ApiProperty({
    enum: RunnerRegion,
    example: Object.values(RunnerRegion)[0],
  })
  region: RunnerRegion;
}
