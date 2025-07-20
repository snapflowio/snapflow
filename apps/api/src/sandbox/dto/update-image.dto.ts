import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

@ApiSchema({ name: "SetImageGeneralStatusDto" })
export class SetImageGeneralStatusDto {
  @ApiProperty({
    description: "Whether the image is general",
    example: true,
  })
  @IsBoolean()
  general: boolean;
}
