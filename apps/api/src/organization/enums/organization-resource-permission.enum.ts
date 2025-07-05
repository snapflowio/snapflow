export enum OrganizationResourcePermission {
  WRITE_REGISTRIES = "write:registries",
  DELETE_REGISTRIES = "delete:registries",

  WRITE_SNAPSHOTS = "write:snapshots",
  DELETE_SNAPSHOTS = "delete:snapshots",

  WRITE_SANDBOXES = "write:sandboxes",
  DELETE_SANDBOXES = "delete:sandboxes",

  READ_VOLUMES = "read:volumes",
  WRITE_VOLUMES = "write:volumes",
  DELETE_VOLUMES = "delete:volumes",
}
