import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { IsArray, IsString } from "class-validator";

@ApiSchema({ name: "UpdateAssignedOrganizationRoles" })
export class UpdateAssignedOrganizationRolesDto {
  @ApiProperty({
    description: "List of role IDs",
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  roleIds: string[];
}
