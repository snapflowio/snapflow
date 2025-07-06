import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

@ApiSchema({ name: "UpdateDockerRegistry" })
export class UpdateDockerRegistryDto {
  @ApiProperty({
    description: "Registry name",
    required: true,
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: "Registry username",
    required: true,
  })
  @IsString()
  username: string;

  @ApiProperty({
    description: "Registry password",
    required: false,
  })
  @IsString()
  @IsOptional()
  password?: string;
}
