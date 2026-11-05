/**
 * Public signing keys of the Supabase project, pinned so the Worker can verify
 * access tokens without asking Supabase. Fetched 2026-11-05 from
 * `<project>/auth/v1/.well-known/jwks.json`. A token with an unknown `kid`
 * makes the verifier fetch that URL again (throttled), so a key rotation still
 * works; update this list after one.
 */
export type SupabaseJwk = {
  kty: "EC";
  crv: "P-256";
  alg: "ES256";
  kid: string;
  x: string;
  y: string;
};

export const PINNED_SUPABASE_JWKS: readonly SupabaseJwk[] = [
  {
    kty: "EC",
    crv: "P-256",
    alg: "ES256",
    kid: "0a9eb361-1d81-4cae-9d19-abd362c60648",
    x: "ql4dh7v6HgNaIWxRerCKKONXztdZgjnfTmv0ORECtKI",
    y: "rJ8NTkEQGvf8Jg_DSoIOa8Cq6A6If5lXa0iBqpYp_W8",
  },
];
