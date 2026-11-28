locals {
  ansible_inventory = yamldecode(file(var.ansible_inventory_file))
  standalone_edges  = try(local.ansible_inventory.standalone_edge.hosts, null) == null ? {} : local.ansible_inventory.standalone_edge.hosts

  edge_dns_records = {
    for name, host in local.standalone_edges : name => {
      hostname = host.standalone_edge_public_host
      address  = host.public_ip
      zones    = [for zone in local.zone_domains : zone if endswith(host.standalone_edge_public_host, ".${zone}")]
    }
  }
}

resource "cloudflare_dns_record" "edge" {
  for_each = local.edge_dns_records

  zone_id = data.cloudflare_zone.zone[one(each.value.zones)].zone_id
  type    = "A"
  name    = each.value.hostname
  content = each.value.address
  comment = "Standalone edge ${each.key}; DNS-only because exposures carry raw TCP and UDP"
  ttl     = local.automatic_ttl
  proxied = false

  lifecycle {
    precondition {
      condition     = length(each.value.zones) == 1
      error_message = "Edge ${each.key} has public host ${each.value.hostname}, which is not under exactly one zone this configuration manages."
    }
  }
}
