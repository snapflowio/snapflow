import { ApiPropertyOptional, ApiSchema } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";

@ApiSchema({ name: "UpdateUser" })
export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  emailVerified?: boolean;
}
