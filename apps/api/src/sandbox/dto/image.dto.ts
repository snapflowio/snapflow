import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Image } from "../entities/image.entity";
import { ImageState } from "../enums/image-state.enum";
import { BuildInfoDto } from "./build-info.dto";

export class ImageDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  organizationId?: string;

  @ApiProperty()
  general: boolean;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  imageName?: string;

  @ApiProperty()
  enabled: boolean;

  @ApiProperty({
    enum: ImageState,
    enumName: "ImageState",
  })
  state: ImageState;

  @ApiProperty({ nullable: true })
  size?: number;

  @ApiProperty({ nullable: true })
  entrypoint?: string[];

  @ApiProperty()
  cpu: number;

  @ApiProperty()
  gpu: number;

  @ApiProperty()
  mem: number;

  @ApiProperty()
  disk: number;

  @ApiProperty({ nullable: true })
  errorReason?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ nullable: true })
  lastUsedAt?: Date;

  @ApiPropertyOptional({
    description: "Build information for the image",
    type: BuildInfoDto,
  })
  buildInfo?: BuildInfoDto;

  static fromImage(image: Image): ImageDto {
    return {
      id: image.id,
      organizationId: image.organizationId,
      general: image.general,
      name: image.name,
      imageName: image.imageName,
      enabled: image.enabled,
      state: image.state,
      size: image.size,
      entrypoint: image.entrypoint,
      cpu: image.cpu,
      gpu: image.gpu,
      mem: image.mem,
      disk: image.disk,
      errorReason: image.errorReason,
      createdAt: image.createdAt,
      updatedAt: image.updatedAt,
      lastUsedAt: image.lastUsedAt,
      buildInfo: image.buildInfo
        ? {
            dockerfileContent: image.buildInfo.dockerfileContent,
            contextHashes: image.buildInfo.contextHashes,
            createdAt: image.buildInfo.createdAt,
            updatedAt: image.buildInfo.updatedAt,
          }
        : undefined,
    };
  }
}
