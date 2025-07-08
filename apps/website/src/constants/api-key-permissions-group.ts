import { CreateApiKeyPermissionsEnum } from "@snapflow/api-client";

export interface CreateApiKeyPermissionGroup {
  name: string;
  permissions: CreateApiKeyPermissionsEnum[];
}
