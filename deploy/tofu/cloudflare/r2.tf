resource "cloudflare_r2_bucket" "storage" {
  for_each = local.storage_buckets

  account_id   = local.account_id
  name         = each.key
  location     = upper(local.settings.OBJECT_STORAGE_LOCATION)
  jurisdiction = local.jurisdiction

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [location]
  }
}

resource "cloudflare_r2_bucket" "backups" {
  account_id   = local.account_id
  name         = local.backup_bucket
  jurisdiction = local.jurisdiction

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_r2_bucket_lifecycle" "storage" {
  for_each = cloudflare_r2_bucket.storage

  account_id   = local.account_id
  bucket_name  = each.value.name
  jurisdiction = local.jurisdiction
  rules = concat(
    [{
      id         = "abort-incomplete-multipart-uploads"
      enabled    = true
      conditions = { prefix = "" }
      abort_multipart_uploads_transition = {
        condition = { type = "Age", max_age = local.object_multipart_abort_days * local.seconds_per_day }
      }
    }],
    each.key == local.snapshot_bucket ? [{
      id         = "expire-${trimsuffix(local.staging_prefix, "/")}"
      enabled    = true
      conditions = { prefix = local.staging_prefix }
      delete_objects_transition = {
        condition = { type = "Age", max_age = local.staging_expiry_days * local.seconds_per_day }
      }
    }] : [],
  )
}

resource "cloudflare_r2_bucket_lifecycle" "backups" {
  account_id   = local.account_id
  bucket_name  = cloudflare_r2_bucket.backups.name
  jurisdiction = local.jurisdiction
  rules = concat(
    [for prefix in local.expiring_backup_prefixes : {
      id         = "expire-${trimsuffix(prefix, "/")}"
      enabled    = true
      conditions = { prefix = prefix }
      delete_objects_transition = {
        condition = { type = "Age", max_age = local.backup_retention_days * local.seconds_per_day }
      }
    }],
    [{
      id         = "abort-incomplete-multipart-uploads"
      enabled    = true
      conditions = { prefix = "" }
      abort_multipart_uploads_transition = {
        condition = { type = "Age", max_age = local.backup_multipart_abort_days * local.seconds_per_day }
      }
    }],
  )
}

resource "cloudflare_r2_bucket_lock" "backups" {
  account_id   = local.account_id
  bucket_name  = cloudflare_r2_bucket.backups.name
  jurisdiction = local.jurisdiction
  rules = [for prefix, days in local.backup_lock_days : {
    id        = "retain-${trimsuffix(prefix, "/")}"
    enabled   = true
    prefix    = prefix
    condition = { type = "Age", max_age_seconds = days * local.seconds_per_day }
  }]
}
