import { ApiProperty, ApiPropertyOptional, ApiSchema } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";
import { CreateOrganizationQuotaDto } from "../../organization/dto/create-organization-quota.dto";
import { SystemRole } from "../enums/system-role.enum";

@ApiSchema({ name: "CreateUser" })
export class CreateUserDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty()
  @IsString()
  password: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  emailVerified?: boolean;

  @ApiPropertyOptional({
    enum: SystemRole,
  })
  @IsEnum(SystemRole)
  @IsOptional()
  role?: SystemRole;

  @ApiPropertyOptional()
  @IsOptional()
  personalOrganizationQuota?: CreateOrganizationQuotaDto;
}
