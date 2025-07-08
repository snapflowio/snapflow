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
    name: "Snapshots",
    permissions: [
      CreateApiKeyPermissionsEnum.WRITE_SNAPSHOTS,
      CreateApiKeyPermissionsEnum.DELETE_SNAPSHOTS,
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
    name: "Volumes",
    permissions: [
      CreateApiKeyPermissionsEnum.READ_VOLUMES,
      CreateApiKeyPermissionsEnum.WRITE_VOLUMES,
      CreateApiKeyPermissionsEnum.DELETE_VOLUMES,
    ],
  },
];
