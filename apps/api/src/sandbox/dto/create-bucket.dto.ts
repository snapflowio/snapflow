import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { IsString } from "class-validator";

@ApiSchema({ name: "CreateBucket" })
export class CreateBucketDto {
  @ApiProperty()
  @IsString()
  name?: string;
}
