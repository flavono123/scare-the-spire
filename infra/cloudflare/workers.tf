# The apex and www serve the main Worker; the Worker itself sends www (and cookieless workers.dev
# visitors) to the apex. wrangler.jsonc has no custom_domain routes, so deploys never touch these.
resource "cloudflare_workers_custom_domain" "apex" {
  account_id = local.account_id
  zone_id    = local.zone_id
  hostname   = "scare-the-spire.com"
  service    = "scare-the-spire"
}

resource "cloudflare_workers_custom_domain" "www" {
  account_id = local.account_id
  zone_id    = local.zone_id
  hostname   = "www.scare-the-spire.com"
  service    = "scare-the-spire"
}

# D1 databases bound in wrangler.jsonc (DB) for production and the testbed.
resource "cloudflare_d1_database" "prod" {
  account_id       = local.account_id
  name             = "slseoun-prod"
  read_replication = { mode = "disabled" }

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_d1_database" "testbed" {
  account_id       = local.account_id
  name             = "slseoun-testbed"
  read_replication = { mode = "disabled" }

  lifecycle {
    prevent_destroy = true
  }
}

# Web Analytics beacon site (manual snippet, src/components/cloudflare-web-analytics.tsx).
resource "cloudflare_web_analytics_site" "main" {
  account_id   = local.account_id
  auto_install = false
}
