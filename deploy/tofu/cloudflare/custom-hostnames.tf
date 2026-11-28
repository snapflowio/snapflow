locals {
  custom_hostname_target = local.settings.CUSTOM_HOSTNAME_TARGET
  custom_hostname_edge   = trimspace(split(",", local.settings.EDGE_HOSTS)[0])
}

resource "cloudflare_dns_record" "custom_hostname_target" {
  zone_id = data.cloudflare_zone.zone[local.platform_domain].zone_id
  type    = "CNAME"
  name    = local.custom_hostname_target
  content = local.custom_hostname_edge
  comment = "Cloudflare for SaaS fallback origin; proxied because Cloudflare requires it"
  ttl     = local.automatic_ttl
  proxied = true

  lifecycle {
    precondition {
      condition     = endswith(local.custom_hostname_target, ".${local.platform_domain}") && endswith(local.custom_hostname_edge, ".${local.platform_domain}")
      error_message = "CUSTOM_HOSTNAME_TARGET and the first EDGE_HOSTS entry must both be under PLATFORM_DOMAIN."
    }
  }
}

resource "cloudflare_custom_hostname_fallback_origin" "platform" {
  zone_id = data.cloudflare_zone.zone[local.platform_domain].zone_id
  origin  = cloudflare_dns_record.custom_hostname_target.name
}
