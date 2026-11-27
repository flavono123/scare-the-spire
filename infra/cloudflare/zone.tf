resource "cloudflare_zone" "main" {
  account = { id = local.account_id }
  name    = "scare-the-spire.com"
  type    = "full"

  lifecycle {
    prevent_destroy = true
  }
}

# Search Console domain property (Google).
resource "cloudflare_dns_record" "google_site_verification" {
  zone_id = local.zone_id
  name    = "scare-the-spire.com"
  type    = "TXT"
  content = "\"google-site-verification=7eDg3cfKTwGlvFnih5l_G-bYpuw85qugMgOBRyTkrV8\""
  ttl     = 3600
  proxied = false
}

# Challenge Passage: a solved challenge lasts a day.
resource "cloudflare_zone_setting" "challenge_ttl" {
  zone_id    = local.zone_id
  setting_id = "challenge_ttl"
  value      = 86400
}

# Bot Fight Mode stays off: rules cannot skip it, and it would challenge API and RSC requests.
resource "cloudflare_bot_management" "main" {
  zone_id                   = local.zone_id
  fight_mode                = false
  enable_js                 = false
  ai_bots_protection        = "disabled"
  content_bots_protection   = "disabled"
  crawler_protection        = "disabled"
  ai_training               = "disabled"
  ai_user                   = "disabled"
  aisearch                  = "disabled"
  is_robots_txt_managed     = false
  ai_bots_migration_opt_out = false
  ai_agents = {
    anthropic_agent = "disabled"
    google_agent    = "disabled"
    instinct        = "disabled"
    muse            = "disabled"
    openai_agent    = "disabled"
  }
}
