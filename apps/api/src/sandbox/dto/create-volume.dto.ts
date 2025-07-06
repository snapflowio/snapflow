import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { IsString } from "class-validator";

@ApiSchema({ name: "CreateVolume" })
export class CreateVolumeDto {
  @ApiProperty()
  @IsString()
  name?: string;
}
