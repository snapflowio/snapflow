import { CreateApiKeyPermissionsEnum } from "@snapflow/api-client";

export const CREATE_API_KEY_PERMISSIONS_GROUPS: {
  name: string;
  permissions: CreateApiKeyPermissionsEnum[];
}[] = [
  {
    name: "Sandboxes",
    permissions: [
      CreateApiKeyPermissionsEnum.WRITE_SANDBOXES,
      CreateApiKeyPermissionsEnum.DELETE_SANDBOXES,
    ],
  },
  {
    name: "Images",
    permissions: [
      CreateApiKeyPermissionsEnum.WRITE_IMAGES,
      CreateApiKeyPermissionsEnum.DELETE_IMAGES,
    ],
  },
  {
    name: "Registries",
    permissions: [
      CreateApiKeyPermissionsEnum.WRITE_REGISTRIES,
      CreateApiKeyPermissionsEnum.DELETE_REGISTRIES,
    ],
  },
  {
    name: "Buckets",
    permissions: [
      CreateApiKeyPermissionsEnum.READ_BUCKETS,
      CreateApiKeyPermissionsEnum.WRITE_BUCKETS,
      CreateApiKeyPermissionsEnum.DELETE_BUCKETS,
    ],
  },
];
