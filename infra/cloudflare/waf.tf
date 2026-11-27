# Datacenter networks that are not verified bots get a Managed Challenge before the Worker runs,
# so they never count against the account's 100k daily Worker requests. Azure (8075) stays out
# because GitHub Actions runs there; Google, Cloudflare and Akamai stay out for Private Relay.
resource "cloudflare_ruleset" "custom_firewall" {
  zone_id = local.zone_id
  name    = "default"
  kind    = "zone"
  phase   = "http_request_firewall_custom"

  rules = [{
    description = "bots"
    expression  = "(ip.src.asnum in {16509 14618 396982 14061 24940 16276 63949 20473 31898 45102 132203} and not cf.client.bot)"
    action      = "managed_challenge"
    enabled     = true
  }]
}

import {
  to = cloudflare_ruleset.custom_firewall
  id = "zones/${local.zone_id}/1c85ed9942894f85897db4a273e4eb41"
}
