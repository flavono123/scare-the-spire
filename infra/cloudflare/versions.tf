terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

# Zone-scoped token (Zone WAF, Zone Settings, DNS: Edit on scare-the-spire.com), read by
# bin/cf-tofu from CLOUDFLARE_ZONE_API_TOKEN in .env.local. Not CLOUDFLARE_API_TOKEN: wrangler and
# scripts/cloudflare-auth.mjs would pick that name up and lose their Workers access.
variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
