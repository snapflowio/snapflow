import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsEnum, IsString } from "class-validator";
import { OrganizationResourcePermission } from "../enums/organization-resource-permission.enum";

@ApiSchema({ name: "CreateOrganizationRole" })
export class CreateOrganizationRoleDto {
  @ApiProperty({
    description: "The name of the role",
    example: "Billing",
    required: true,
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: "The description of the role",
    example: "Responsible for billing",
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: "The list of permissions assigned to the created role",
    enum: OrganizationResourcePermission,
    isArray: true,
    required: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(OrganizationResourcePermission, { each: true })
  permissions: OrganizationResourcePermission[];
}
