import { ApiProperty } from "@nestjs/swagger";
import { ImageDto } from "./image.dto";

export class PaginatedImagesDto {
  @ApiProperty({ type: [ImageDto] })
  items: ImageDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  totalPages: number;
}
