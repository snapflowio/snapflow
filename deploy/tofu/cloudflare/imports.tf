import {
  for_each = local.storage_buckets
  to       = cloudflare_r2_bucket.storage[each.key]
  id       = "${local.account_id}/${each.key}/${local.jurisdiction}"
}

import {
  to = cloudflare_r2_bucket.backups
  id = "${local.account_id}/${local.backup_bucket}/${local.jurisdiction}"
}

import {
  for_each = local.zone_setting_entries
  to       = cloudflare_zone_setting.zone[each.key]
  id       = "${data.cloudflare_zone.zone[each.value.zone].zone_id}/${each.value.setting}"
}

import {
  to = cloudflare_ruleset.origin
  id = "zones/${data.cloudflare_zone.zone[local.public_domain].zone_id}/747ddf1aa3fc4a589c4d4c3b271c8052"
}

import {
  to = cloudflare_ruleset.rate_limits
  id = "zones/${data.cloudflare_zone.zone[local.public_domain].zone_id}/7a1de422785640ea83daec858cc30b69"
}

import {
  to = cloudflare_ruleset.config_settings
  id = "zones/${data.cloudflare_zone.zone[local.public_domain].zone_id}/af0b18aaed484ac0a9a2aec3b0501a78"
}

import {
  for_each = {
    public_dmarc     = "74c7594afeba4b765f19069e2cc99c2c"
    platform_null_mx = "eed90f14a7b77ba62fd8e0b18840b230"
    platform_dmarc   = "3dbefa9bfe7d178da71a87dc93c3671b"
    platform_spf     = "a57afd738892f3db8cbcb8acf3e635f0"
  }
  to = cloudflare_dns_record.mail_policy[each.key]
  id = "${data.cloudflare_zone.zone[local.mail_policy_records[each.key].zone].zone_id}/${each.value}"
}
