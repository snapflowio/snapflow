import { ApiProperty, ApiSchema } from "@nestjs/swagger";

@ApiSchema({ name: "UploadFile" })
export class UploadFileDto {
  @ApiProperty({ type: "string", format: "binary" })
  file: any;

  @ApiProperty()
  path: string;
}
