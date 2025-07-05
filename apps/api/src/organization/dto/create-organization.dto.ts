import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

@ApiSchema({ name: "CreateOrganization" })
export class CreateOrganizationDto {
  @ApiProperty({
    description: "Name of the organization",
    example: "Example organization",
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  name: string;
}
