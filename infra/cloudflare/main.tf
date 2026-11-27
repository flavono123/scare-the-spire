# Cloudflare account and the scare-the-spire.com zone (Cloudflare Registrar, Free plan). Worker code,
# bindings, vars, crons and workers.dev stay with wrangler (CI deploys); everything they run on is here.
locals {
  account_id = "3c6cb736f46ca4495993cad43c1b1ff3"
  zone_id    = "2b2a45e8cf195c29f25582331228fd22"
}
