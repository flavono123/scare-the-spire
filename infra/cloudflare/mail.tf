# The domain sends and receives no mail, so receivers must reject anything claiming to come from
# it: SPF allows no sender, DMARC rejects, an empty DKIM key revokes every selector, and the null
# MX (RFC 7505) says nothing here accepts mail.
resource "cloudflare_dns_record" "spf" {
  zone_id = local.zone_id
  name    = "scare-the-spire.com"
  type    = "TXT"
  content = "\"v=spf1 -all\""
  ttl     = 3600
}

resource "cloudflare_dns_record" "dmarc" {
  zone_id = local.zone_id
  name    = "_dmarc.scare-the-spire.com"
  type    = "TXT"
  content = "\"v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s\""
  ttl     = 3600
}

resource "cloudflare_dns_record" "dkim_revoked" {
  zone_id = local.zone_id
  name    = "*._domainkey.scare-the-spire.com"
  type    = "TXT"
  content = "\"v=DKIM1; p=\""
  ttl     = 3600
}

resource "cloudflare_dns_record" "null_mx" {
  zone_id  = local.zone_id
  name     = "scare-the-spire.com"
  type     = "MX"
  content  = "."
  priority = 0
  ttl      = 3600
}
