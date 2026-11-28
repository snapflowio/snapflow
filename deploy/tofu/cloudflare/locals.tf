locals {
  settings = {
    for pair in regexall("(?m)^([A-Z0-9_]+)=(.*)$", file(var.cluster_settings_file)) : pair[0] => pair[1]
  }
  account_id = regex("^https://([0-9a-f]{32})\\.r2\\.cloudflarestorage\\.com/?$", local.settings.OBJECT_STORAGE_ENDPOINT)[0]

  seconds_per_day = 86400
  jurisdiction    = "default"

  object_bucket   = local.settings.OBJECT_STORAGE_BUCKET
  snapshot_bucket = local.settings.OBJECT_STORAGE_SNAPSHOT_BUCKET
  backup_bucket   = local.settings.BACKUP_S3_BUCKET
  storage_buckets = toset([local.object_bucket, local.snapshot_bucket])

  object_multipart_abort_days = 1
  staging_prefix              = "direct-uploads/"
  staging_expiry_days         = 1

  backup_multipart_abort_days = 7
  backup_retention_days       = 30
  expiring_backup_prefixes    = ["openbao/"]
  backup_lock_days = {
    "postgres/" = 14
    "openbao/"  = 14
    "k3s/"      = 6
  }
}
