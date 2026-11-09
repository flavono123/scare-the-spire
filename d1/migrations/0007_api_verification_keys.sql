-- Supabase exit step 4 prerequisite (docs/supabase-exit/STEP1_DESIGN.md 6): the Supabase token signing
-- keys the Worker trusts, with revocation, before the Worker is the only verifier. The compiled-in key
-- (workers/api/supabase-jwks.ts) is the seed: it counts unless a row with its kid says otherwise, and it
-- alone counts while this table is empty or unreadable. Read by the Worker at most once a minute per
-- isolate (K1). Change rows only with scripts/verification-keys.ts. Times here are INTEGER Unix ms.
-- Generated from docs/supabase-exit/d1-schema/schema.src.sql by gen_schema.py: edit the source
-- and regenerate (check.py fails when they differ). Once applied to a remote database, never
-- change this file; add a new migration section to the source instead.

-- One row per key id. A revoked kid is refused even while Supabase's JWKS still lists it, so a revoke
-- row may carry no coordinates (a key the Worker only ever saw in the live JWKS).
CREATE TABLE IF NOT EXISTS api_verification_keys (
  kid TEXT NOT NULL PRIMARY KEY CHECK (length(kid) BETWEEN 1 AND 128),
  -- The only kind of key the verifier imports: ES256 on P-256 (jwt.ts).
  alg TEXT NOT NULL DEFAULT 'ES256' CHECK (alg = 'ES256'),
  -- base64url P-256 coordinates: 32 bytes are 43 characters without padding.
  x TEXT CHECK (length(x) = 43 AND x NOT GLOB '*[^A-Za-z0-9_-]*'),
  y TEXT CHECK (length(y) = 43 AND y NOT GLOB '*[^A-Za-z0-9_-]*'),
  added_at INTEGER NOT NULL,
  revoked_at INTEGER,
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 200),
  CHECK ((x IS NULL) = (y IS NULL)),
  -- A key the Worker may accept has both coordinates.
  CHECK (revoked_at IS NOT NULL OR x IS NOT NULL)
) STRICT, WITHOUT ROWID;
