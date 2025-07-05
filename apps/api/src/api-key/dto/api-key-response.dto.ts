import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { OrganizationResourcePermission } from "../../organization/enums/organization-resource-permission.enum";
import { ApiKey } from "../api-key.entity";

@ApiSchema({ name: "ApiKeyResponse" })
export class ApiKeyResponseDto {
  @ApiProperty({
    description: "The name of the API key",
    example: "Test API Key",
  })
  name: string;

  @ApiProperty({
    description: "The value of the API key",
    example: "snapflow_1234567890abcdef",
  })
  value: string;

  @ApiProperty({
    description: "List of permissions given to the API key",
    enum: OrganizationResourcePermission,
    isArray: true,
  })
  permissions: OrganizationResourcePermission[];

  @ApiProperty({
    description: "When the API key was made",
    example: "2025-07-1T12:00:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "When the API key is set to expire",
    example: "2025-07-1T12:00:00.000Z",
    nullable: true,
  })
  expiresAt?: Date;

  static fromApiKey(apiKey: ApiKey, value: string): ApiKeyResponseDto {
    return {
      name: apiKey.name,
      value,
      permissions: apiKey.permissions,
      createdAt: apiKey.createdAt,
      expiresAt: apiKey.expiresAt,
    };
  }
}
