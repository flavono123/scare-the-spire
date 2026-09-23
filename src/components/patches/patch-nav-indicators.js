/* Static patch pages do not hydrate the main navbar.
   Cache keys match src/lib/nav-indicators.ts and src/hooks/use-mailbox-reply.ts. */
(function () {
  const CACHE_MS = 60_000;
  const configNode = document.getElementById("sts-patch-comments-config");
  if (!configNode?.textContent) return;

  let config;
  try {
    config = JSON.parse(configNode.textContent);
  } catch {
    return;
  }
  if (!config.supabaseUrl || !config.supabaseAnonKey) return;

  const env = config.supabaseEnv || "production";
  const restRoot = config.supabaseUrl.replace(/\/$/, "");

  function show(name, on) {
    document.querySelectorAll(`[data-nav-attention="${name}"]`).forEach((node) => {
      node.hidden = !on;
    });
  }

  function readCache(key) {
    try {
      const raw = window.sessionStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed.at !== "number" || Date.now() - parsed.at > CACHE_MS) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function writeCache(key, value) {
    try {
      window.sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), ...value }));
    } catch {
      // Private browsing can reject sessionStorage.
    }
  }

  function restHeaders(accessToken) {
    return {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${accessToken || config.supabaseAnonKey}`,
    };
  }

  const navKey = `sts-nav-indicators:${env}`;
  const cachedNav = readCache(navKey);
  if (cachedNav?.flags) {
    show("patch-notes", cachedNav.flags.patchNotes === true);
    show("toy-box", cachedNav.flags.toyBox === true);
  } else {
    const navUrl = `${restRoot}/rest/v1/nav_indicators?select=patch_notes,toy_box&env=eq.${encodeURIComponent(env)}`;
    fetch(navUrl, { headers: restHeaders() })
      .then((response) => (response.ok ? response.json() : null))
      .then((rows) => {
        if (!Array.isArray(rows)) return;
        const row = rows[0];
        const flags = {
          patchNotes: row?.patch_notes === true,
          toyBox: row?.toy_box === true,
        };
        writeCache(navKey, { flags });
        show("patch-notes", flags.patchNotes);
        show("toy-box", flags.toyBox);
      })
      .catch(() => {});
  }

  const host = new URL(config.supabaseUrl).hostname.split(".")[0];
  let session = null;
  try {
    session = JSON.parse(window.localStorage.getItem(`sb-${host}-auth-token`) || "null");
  } catch {
    session = null;
  }
  const accessToken = session?.access_token || session?.currentSession?.access_token;
  const expiresAt = session?.expires_at || session?.currentSession?.expires_at;
  const userId = session?.user?.id || session?.currentSession?.user?.id;
  if (!accessToken || !userId || (expiresAt && expiresAt * 1000 < Date.now())) return;

  const mailboxKey = `sts-mailbox-reply:${env}:${userId}`;
  const cachedMailbox = readCache(mailboxKey);
  if (typeof cachedMailbox?.unseen === "boolean") {
    show("mailbox", cachedMailbox.unseen);
    return;
  }

  const mailboxUrl = `${restRoot}/rest/v1/contact_inquiries?select=id&env=eq.${encodeURIComponent(env)}&admin_response=not.is.null&reply_seen_at=is.null&limit=1`;
  fetch(mailboxUrl, { headers: restHeaders(accessToken) })
    .then((response) => (response.ok ? response.json() : null))
    .then((rows) => {
      if (!Array.isArray(rows)) return;
      const unseen = rows.length > 0;
      writeCache(mailboxKey, { unseen });
      show("mailbox", unseen);
    })
    .catch(() => {});
})();
