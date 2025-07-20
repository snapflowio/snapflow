import { ApiProperty, ApiPropertyOptional, ApiSchema } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsNumber, IsObject, IsOptional, IsString } from "class-validator";
import { CreateBuildInfoDto } from "./create-build-info.dto";

@ApiSchema({ name: "CreateImage" })
export class CreateImageDto {
  @ApiProperty({
    description: "The name of the image",
    example: "ubuntu-4vcpu-8ram-100gb",
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: "The image name of the image",
    example: "ubuntu:22.04",
  })
  @IsOptional()
  @IsString()
  imageName?: string;

  @ApiPropertyOptional({
    description: "The entrypoint command for the image",
    example: "sleep infinity",
  })
  @IsString({
    each: true,
  })
  @IsArray()
  @IsOptional()
  entrypoint?: string[];

  @ApiPropertyOptional({
    description: "Whether the image is general",
  })
  @IsBoolean()
  @IsOptional()
  general?: boolean;

  @ApiPropertyOptional({
    description: "CPU cores allocated to the resulting sandbox",
    example: 1,
    type: "integer",
  })
  @IsOptional()
  @IsNumber()
  cpu?: number;

  @ApiPropertyOptional({
    description: "GPU units allocated to the resulting sandbox",
    example: 0,
    type: "integer",
  })
  @IsOptional()
  @IsNumber()
  gpu?: number;

  @ApiPropertyOptional({
    description: "Memory allocated to the resulting sandbox in GB",
    example: 1,
    type: "integer",
  })
  @IsOptional()
  @IsNumber()
  memory?: number;

  @ApiPropertyOptional({
    description: "Disk space allocated to the sandbox in GB",
    example: 3,
    type: "integer",
  })
  @IsOptional()
  @IsNumber()
  disk?: number;

  @ApiPropertyOptional({
    description: "Build information for the image",
    type: CreateBuildInfoDto,
  })
  @IsOptional()
  @IsObject()
  buildInfo?: CreateBuildInfoDto;
}
