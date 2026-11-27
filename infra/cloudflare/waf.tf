# Deploy smoke sends this header (CF_SMOKE_BYPASS secret, CLOUDFLARE_SMOKE_BYPASS in .env.local);
# GitHub runners sit on networks the rules below challenge.
variable "smoke_bypass" {
  type      = string
  sensitive = true
}

# Custom rules run in order; Free allows five. Challenged and blocked requests never reach the
# Worker, so they never count against the account's 100k daily Worker requests.
resource "cloudflare_ruleset" "custom_firewall" {
  zone_id = local.zone_id
  name    = "default"
  kind    = "zone"
  phase   = "http_request_firewall_custom"

  rules = [
    {
      description = "deploy smoke"
      expression  = "any(http.request.headers[\"x-slseoun-smoke\"][*] eq \"${var.smoke_bypass}\")"
      action      = "skip"
      action_parameters = {
        ruleset = "current"
      }
      logging = { enabled = true }
      enabled = true
    },
    {
      # Meta's crawler arrives as a verified bot with a desktop Chrome user agent, outside the AI
      # Crawler category; only its link preview fetcher (facebookexternalhit) gets through.
      description = "ai crawlers"
      expression  = "(cf.verified_bot_category eq \"AI Crawler\") or (ip.src.asnum eq 32934 and not http.user_agent contains \"facebookexternalhit\")"
      action      = "block"
      enabled     = true
    },
    {
      # Datacenter networks that are not verified bots. Azure (8075) stays out because GitHub
      # Actions runs there; Google, Cloudflare and Akamai stay out for Private Relay.
      description = "bots"
      expression  = "(ip.src.asnum in {16509 14618 396982 14061 24940 16276 63949 20473 31898 45102 132203} and not cf.client.bot)"
      action      = "managed_challenge"
      enabled     = true
    },
    {
      # Scrapers rotate through residential networks no ASN list catches. Korea, where the readers
      # are, never sees it; everyone else passes once a day (Challenge Passage). /__handoff is the
      # workers.dev form post that carries a profile over and cannot survive a challenge.
      description = "outside korea"
      expression  = "(ip.src.country ne \"KR\" and not cf.client.bot and http.request.uri.path ne \"/__handoff\")"
      action      = "managed_challenge"
      enabled     = true
    },
  ]
}

import {
  to = cloudflare_ruleset.custom_firewall
  id = "zones/${local.zone_id}/1c85ed9942894f85897db4a273e4eb41"
}

# Free allows one rate limiting rule: per IP, a 10 second window and a 10 second block. A page
# view makes two or three /api requests, so 50 in 10 seconds is far past any reader while a
# scraper looping the API stops before the Worker counts it. The Worker's own API_READ_LIMITER
# (600 a minute) still answers what gets through.
resource "cloudflare_ruleset" "rate_limit" {
  zone_id = local.zone_id
  name    = "default"
  kind    = "zone"
  phase   = "http_ratelimit"

  rules = [{
    description = "api per ip"
    expression  = "(starts_with(http.request.uri.path, \"/api/\"))"
    action      = "block"
    ratelimit = {
      characteristics     = ["ip.src", "cf.colo.id"]
      period              = 10
      requests_per_period = 50
      mitigation_timeout  = 10
    }
    enabled = true
  }]
}
