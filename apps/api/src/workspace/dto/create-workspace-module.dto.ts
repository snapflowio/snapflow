import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

@ApiSchema({ name: "CreateWorkspace" })
export class CreateWorkspaceDto {
  @ApiProperty({
    description: "Name of the module",
    example: "Example module",
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: "The code or unique number for your class",
    example: "CS1020",
    required: false,
  })
  @IsString()
  @IsOptional()
  classCode: string;
}
