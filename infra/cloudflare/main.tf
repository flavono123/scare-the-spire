# The scare-the-spire.com zone (Cloudflare Registrar, Free plan). Workers custom domains for the
# apex and www belong to wrangler.jsonc routes, not here.
locals {
  zone_id = "2b2a45e8cf195c29f25582331228fd22"
}

# Datacenter networks that are not verified bots get a Managed Challenge before the Worker runs,
# so they never count against the account's 100k daily Worker requests. Azure (8075) stays out
# because GitHub Actions runs there; Google, Cloudflare and Akamai stay out for Private Relay.
resource "cloudflare_ruleset" "custom_firewall" {
  zone_id = local.zone_id
  name    = "default"
  kind    = "zone"
  phase   = "http_request_firewall_custom"

  rules = [{
    description = "Challenge datacenter ASNs that are not verified bots"
    expression  = "(ip.src.asnum in {16509 14618 396982 14061 24940 16276 63949 20473 31898 45102 132203} and not cf.client.bot)"
    action      = "managed_challenge"
    enabled     = true
  }]
}

# Challenge Passage: a solved challenge lasts a day.
resource "cloudflare_zone_setting" "challenge_ttl" {
  zone_id    = local.zone_id
  setting_id = "challenge_ttl"
  value      = 86400
}
