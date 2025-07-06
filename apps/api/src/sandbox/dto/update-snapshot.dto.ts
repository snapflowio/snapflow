import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

@ApiSchema({ name: "SetSnapshotGeneralStatusDto" })
export class SetSnapshotGeneralStatusDto {
  @ApiProperty({
    description: "Whether the snapshot is general",
    example: true,
  })
  @IsBoolean()
  general: boolean;
}
