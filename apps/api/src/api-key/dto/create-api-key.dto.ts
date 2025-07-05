import { ApiProperty, ApiPropertyOptional, ApiSchema } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import { OrganizationResourcePermission } from "../../organization/enums/organization-resource-permission.enum";

@ApiSchema({ name: "CreateApiKey" })
export class CreateApiKeyDto {
  @ApiProperty({
    description: "The name of the API key",
    example: "Test API Key",
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description:
      "The list of organization resource permissions assigned to the API key",
    enum: OrganizationResourcePermission,
    isArray: true,
    required: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(OrganizationResourcePermission, { each: true })
  permissions: OrganizationResourcePermission[];

  @ApiPropertyOptional({
    description: "When the API key is set to expire",
    example: "2025-07-1T12:00:00.000Z",
    nullable: true,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;
}
