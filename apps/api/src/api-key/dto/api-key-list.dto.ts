import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { OrganizationResourcePermission } from "../../organization/enums/organization-resource-permission.enum";
import { ApiKey } from "../api-key.entity";

@ApiSchema({ name: "ApiKeyList" })
export class ApiKeyListDto {
  @ApiProperty({
    description: "The name of the API key",
    example: "Test API Key",
  })
  name: string;

  @ApiProperty({
    description: "The hidden API key value",
    example: "snapflow_************************",
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

  @ApiProperty({
    description: "When the latest request was made using the API key",
    example: "2025-07-1T12:00:00.000Z",
    nullable: true,
  })
  lastUsedAt?: Date;

  constructor(partial: Partial<ApiKeyListDto>) {
    Object.assign(this, partial);
  }

  static fromApiKey(apiKey: ApiKey): ApiKeyListDto {
    const hiddenValue = `${apiKey.keyPrefix}********************${apiKey.keySuffix}`;

    return new ApiKeyListDto({
      name: apiKey.name,
      value: hiddenValue,
      permissions: apiKey.permissions,
      createdAt: apiKey.createdAt,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
    });
  }
}
