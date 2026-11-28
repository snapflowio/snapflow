locals {
  public_domain   = local.settings.PUBLIC_DOMAIN
  registry_domain = local.settings.REGISTRY_DOMAIN
  platform_domain = local.settings.PLATFORM_DOMAIN
  zone_domains    = toset([local.public_domain, local.platform_domain])

  automatic_ttl = 1

  zone_settings = {
    ssl              = "strict"
    always_use_https = "on"
    tls_client_auth  = "on"
    min_tls_version  = "1.2"
  }
  zone_setting_entries = {
    for pair in setproduct(local.zone_domains, keys(local.zone_settings)) :
    "${pair[0]}/${pair[1]}" => { zone = pair[0], setting = pair[1] }
  }

  traefik_cloudflare_port  = 9444
  traefik_cloudflare_hosts = [local.public_domain, local.registry_domain]

  auth_path_prefix          = "/api/auth/"
  auth_rate_period_seconds  = 10
  auth_rate_requests        = 30
  auth_rate_block_seconds   = 10
  auth_rate_characteristics = ["ip.src", "cf.colo.id"]

  api_path_prefix               = "/api/"
  machine_client_security_level = "essentially_off"

  mail_policy_records = {
    public_dmarc = {
      zone    = local.public_domain
      type    = "TXT"
      name    = "_dmarc.${local.public_domain}"
      content = "\"v=DMARC1; p=none; rua=mailto:bryan.lawless@snapflow.io\""
      comment = "Monitoring only; tighten once mail sending is set up"
    }
    platform_null_mx = {
      zone     = local.platform_domain
      type     = "MX"
      name     = local.platform_domain
      content  = "."
      priority = 0
      comment  = "Null MX (RFC 7505): this domain receives no email"
    }
    platform_dmarc = {
      zone    = local.platform_domain
      type    = "TXT"
      name    = "_dmarc.${local.platform_domain}"
      content = "\"v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s\""
      comment = "Reject mail claiming to be from this domain or its subdomains"
    }
    platform_spf = {
      zone    = local.platform_domain
      type    = "TXT"
      name    = local.platform_domain
      content = "\"v=spf1 -all\""
      comment = "This domain sends no email"
    }
  }
}

data "cloudflare_zone" "zone" {
  for_each = local.zone_domains

  filter = {
    name = each.key
  }
}

resource "cloudflare_zone_setting" "zone" {
  for_each = local.zone_setting_entries

  zone_id    = data.cloudflare_zone.zone[each.value.zone].zone_id
  setting_id = each.value.setting
  value      = local.zone_settings[each.value.setting]
}

resource "cloudflare_ruleset" "origin" {
  zone_id = data.cloudflare_zone.zone[local.public_domain].zone_id
  kind    = "zone"
  name    = "default"
  phase   = "http_request_origin"
  rules = [{
    ref         = "traefik-cloudflare-entrypoint"
    description = "${join(" and ", local.traefik_cloudflare_hosts)} to the Traefik Cloudflare-only entrypoint on ${local.traefik_cloudflare_port}"
    expression  = "(http.host in {${join(" ", formatlist("\"%s\"", local.traefik_cloudflare_hosts))}})"
    action      = "route"
    action_parameters = {
      origin = { port = local.traefik_cloudflare_port }
    }
    enabled = true
  }]
}

resource "cloudflare_ruleset" "rate_limits" {
  zone_id     = data.cloudflare_zone.zone[local.public_domain].zone_id
  kind        = "zone"
  name        = "default"
  phase       = "http_ratelimit"
  description = "Snapflow rate limits"
  rules = [{
    ref         = "auth-endpoints"
    description = "Auth endpoints: ${local.auth_rate_requests} requests per ${local.auth_rate_period_seconds} seconds per IP"
    expression  = "(http.host eq \"${local.public_domain}\" and starts_with(http.request.uri.path, \"${local.auth_path_prefix}\"))"
    action      = "block"
    ratelimit = {
      characteristics     = local.auth_rate_characteristics
      period              = local.auth_rate_period_seconds
      requests_per_period = local.auth_rate_requests
      mitigation_timeout  = local.auth_rate_block_seconds
    }
    enabled = true
  }]
}

resource "cloudflare_ruleset" "config_settings" {
  zone_id = data.cloudflare_zone.zone[local.public_domain].zone_id
  kind    = "zone"
  name    = "default"
  phase   = "http_config_settings"
  rules = [{
    ref         = "machine-clients-skip-challenge"
    description = "Machine clients (registry and API) skip the Under Attack browser challenge"
    expression  = "(http.host eq \"${local.registry_domain}\") or (http.host eq \"${local.public_domain}\" and starts_with(http.request.uri.path, \"${local.api_path_prefix}\"))"
    action      = "set_config"
    action_parameters = {
      security_level = local.machine_client_security_level
    }
    enabled = true
  }]
}

resource "cloudflare_dns_record" "mail_policy" {
  for_each = local.mail_policy_records

  zone_id  = data.cloudflare_zone.zone[each.value.zone].zone_id
  type     = each.value.type
  name     = each.value.name
  content  = each.value.content
  priority = try(each.value.priority, null)
  comment  = each.value.comment
  ttl      = local.automatic_ttl
  proxied  = false
}
