export enum OrganizationResourcePermission {
  WRITE_REGISTRIES = "write:registries",
  DELETE_REGISTRIES = "delete:registries",

  WRITE_IMAGES = "write:images",
  DELETE_IMAGES = "delete:images",

  WRITE_SANDBOXES = "write:sandboxes",
  DELETE_SANDBOXES = "delete:sandboxes",

  READ_BUCKETS = "read:buckets",
  WRITE_BUCKETS = "write:buckets",
  DELETE_BUCKETS = "delete:buckets",
}
