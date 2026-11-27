# Live resources adopted into state. Imports are idempotent, so a lost local state comes back with
# `bin/cf-tofu apply` and no changes.
import {
  to = cloudflare_zone.main
  id = local.zone_id
}

import {
  to = cloudflare_zone_setting.challenge_ttl
  id = "${local.zone_id}/challenge_ttl"
}

import {
  to = cloudflare_bot_management.main
  id = local.zone_id
}

import {
  to = cloudflare_dns_record.google_site_verification
  id = "${local.zone_id}/5779622a935dd4666a5dac43b10947b5"
}

import {
  to = cloudflare_workers_custom_domain.apex
  id = "${local.account_id}/50acb0809d628bc2d292d0c0f715006982df9cab"
}

import {
  to = cloudflare_workers_custom_domain.www
  id = "${local.account_id}/4accb4042e138bffed616c37687c30070edd2516"
}

import {
  to = cloudflare_d1_database.prod
  id = "${local.account_id}/b0dc1d98-7091-4d77-bccf-8bdb05a32af5"
}

import {
  to = cloudflare_d1_database.testbed
  id = "${local.account_id}/11081204-f9ca-4b30-b2e0-07ca427cc410"
}

import {
  to = cloudflare_web_analytics_site.main
  id = "${local.account_id}/deea529940144822af85deaf80517ceb"
}
