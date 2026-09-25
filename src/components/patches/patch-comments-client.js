(() => {
  const CONFIG_ID = "sts-patch-comments-config";
  const PROFILE_KEY = "sts-user-profile";
  const QUERY_TIMEOUT_MS = 8000;
  const AUTH_TIMEOUT_MS = 8000;
  const COMMENT_MIN_CHARS = 2;
  const COMMENT_MAX_CHARS = 200;
  const CHARACTER_ICON_SLUGS = {
    IRONCLAD: "ironclad",
    SILENT: "silent",
    REGENT: "regent",
    NECROBINDER: "necrobinder",
    DEFECT: "defect",
  };
  // Keep in sync with PROFILE_PALETTE_PAIRS (excludes ivory-sky).
  const PROFILE_PALETTES = {
    "sage-blush": ["#719470", "#E0B3B6"],
    "orange-teal": ["#D96629", "#0093A5"],
    "rose-mint": ["#DA525D", "#00B49B"],
    "coffee-olive": ["#71502F", "#788860"],
    "magenta-blue": ["#B73F74", "#005B8D"],
    "lime-purple": ["#C7D14F", "#501345"],
    "lemon-olive": ["#FFEFAE", "#42533E"],
    "amber-coffee": ["#F3A257", "#71502F"],
    "apricot-blue": ["#FDD4BD", "#006EB8"],
    "ochre-lavender": ["#C27544", "#B5B1D8"],
    "terracotta-dusty-pink": ["#C55347", "#C0A9B3"],
    "pine-navy": ["#437742", "#064F6E"],
    "jade-lavender": ["#00978D", "#B5B1D8"],
    "carmine-ink": ["#CC1236", "#0F1A14"],
    "coral-midnight": ["#F48067", "#051230"],
  };
  const PROFILE_CHANGE_EVENT = "sts-user-profile-change";
  const UNSET_PROFILE_TOKEN_URL = "/images/sts2/profile/unset.webp";

  const MESSAGES = {
    ko: {
      loading: "불러오는 중...",
      empty: "아직 댓글이 없습니다",
      delete: "삭제",
      likeAlt: "좋아요",
      nicknamePlaceholder: "닉네임",
      defaultNickname: "닉",
      placeholder: "댓글을 입력하세요",
      submit: "작성",
      unavailableTitle: "데이터베이스가 응답하지 않습니다",
      storyTitle: "이 변경으로 이야기 쓰기",
      storyPlaceholder: "이 변경에서 떠오른 이야기를 남겨보세요",
      storyNickname: "닉네임",
      storySubmit: "작성",
      storySubmitting: "...",
      storyClose: "닫기",
      storyUnavailable: "이야기를 저장하지 못했습니다",
    },
    en: {
      loading: "Loading...",
      empty: "No comments yet",
      delete: "Delete",
      likeAlt: "Like",
      nicknamePlaceholder: "Nickname",
      defaultNickname: "Nick",
      placeholder: "Write a comment",
      submit: "Post",
      unavailableTitle: "No responses from database",
      storyTitle: "Write story from this change",
      storyPlaceholder: "Share the story this change brought to mind",
      storyNickname: "Nickname",
      storySubmit: "Write",
      storySubmitting: "...",
      storyClose: "Close",
      storyUnavailable: "Could not save the story",
    },
  };

  function readConfig() {
    const element = document.getElementById(CONFIG_ID);
    if (!element?.textContent) return null;

    try {
      const parsed = JSON.parse(element.textContent);
      if (!parsed.supabaseUrl || !parsed.supabaseAnonKey) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function serviceLocale() {
    return document.documentElement.dataset.serviceLocale === "en" ? "en" : "ko";
  }

  function copy() {
    return MESSAGES[serviceLocale()];
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderText(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
  }

  function commentCountClass(length) {
    if (length === 0) return "text-muted-foreground";
    if (length < COMMENT_MIN_CHARS || length > COMMENT_MAX_CHARS) return "text-red-400";
    const warnRemaining = Math.max(5, Math.ceil(COMMENT_MAX_CHARS * 0.1));
    if (length >= COMMENT_MAX_CHARS - warnRemaining) return "text-primary";
    return "text-muted-foreground";
  }

  function syncCommentCounter(root) {
    const contentInput = root.querySelector("[data-comment-content]");
    const count = root.querySelector("[data-comment-count]");
    if (!contentInput || !count) return;
    const length = contentInput.value.length;
    count.textContent = `${length}/${COMMENT_MAX_CHARS}`;
    count.className = `shrink-0 font-mono text-xs tabular-nums ${commentCountClass(length)}`;
  }

  function characterIconUrl(characterId) {
    const slug = CHARACTER_ICON_SLUGS[characterId] ?? CHARACTER_ICON_SLUGS.NECROBINDER;
    return `/images/sts2/characters/character_icon_${slug}.webp`;
  }

  function hexToRgb255(hex) {
    const raw = String(hex).replace("#", "");
    return {
      r: Number.parseInt(raw.slice(0, 2), 16),
      g: Number.parseInt(raw.slice(2, 4), 16),
      b: Number.parseInt(raw.slice(4, 6), 16),
    };
  }

  function remapDuotoneRgba(data, shadow, highlight) {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const t = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      data[i] = Math.round(shadow.r + (highlight.r - shadow.r) * t);
      data[i + 1] = Math.round(shadow.g + (highlight.g - shadow.g) * t);
      data[i + 2] = Math.round(shadow.b + (highlight.b - shadow.b) * t);
    }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load ${src}`));
      image.src = src;
    });
  }

  function hasStoredUserProfile(raw) {
    return typeof raw === "string" && raw.trim().length > 0;
  }

  function readStoredProfileIconState() {
    try {
      const raw = window.localStorage.getItem(PROFILE_KEY);
      if (!hasStoredUserProfile(raw)) {
        return {
          stored: false,
          tokenUrl: UNSET_PROFILE_TOKEN_URL,
          pair: null,
          swapped: false,
          nickname: "",
        };
      }
      const parsed = JSON.parse(raw);
      const characterId = typeof parsed.characterId === "string" ? parsed.characterId : "NECROBINDER";
      const avatarKind = parsed.avatarKind === "boss" ? "boss" : "character";
      const avatarId = typeof parsed.avatarId === "string" && parsed.avatarId
        ? parsed.avatarId
        : characterId;
      const tokenUrl = avatarKind === "boss"
        ? `/images/sts2/bosses/${String(avatarId).toLowerCase()}.webp`
        : characterIconUrl(avatarKind === "character" ? avatarId : characterId);
      const pair = typeof parsed.paletteId === "string" ? PROFILE_PALETTES[parsed.paletteId] : null;
      const swapped = Boolean(parsed.paletteSwapped);
      const nickname = typeof parsed.nickname === "string" ? parsed.nickname.trim() : "";
      return {
        stored: true,
        tokenUrl,
        pair,
        swapped,
        nickname,
        avatarId: typeof avatarId === "string" ? avatarId : null,
        avatarKind,
        paletteId: typeof parsed.paletteId === "string" ? parsed.paletteId : null,
      };
    } catch {
      return {
        stored: false,
        tokenUrl: UNSET_PROFILE_TOKEN_URL,
        pair: null,
        swapped: false,
        nickname: "",
        avatarId: null,
        avatarKind: null,
        paletteId: null,
      };
    }
  }

  function displayedCommentNickIcon(state, comment) {
    if (typeof comment.avatar_id === "string" && comment.avatar_id.trim()) {
      const trimmed = comment.avatar_id.trim();
      const isBoss = comment.avatar_kind === "boss";
      const tokenUrl = isBoss
        ? `/images/sts2/bosses/${trimmed.toLowerCase()}.webp`
        : characterIconUrl(trimmed);
      const pair = typeof comment.palette_id === "string" ? PROFILE_PALETTES[comment.palette_id] : null;
      const swapped = Boolean(comment.palette_swapped);
      return { kind: "profile", tokenUrl, pair, swapped, paletteId: comment.palette_id ?? null };
    }
    if (comment.avatar_id === null) {
      return { kind: "unset", tokenUrl: UNSET_PROFILE_TOKEN_URL, pair: null, swapped: false, paletteId: null };
    }
    const profile = readStoredProfileIconState();
    const isOwner = Boolean(state.userId && state.userId === comment.user_id);
    const nickMatch = String(comment.nickname ?? "").trim() === profile.nickname;
    if (profile.stored && isOwner && nickMatch) {
      return { kind: "profile", tokenUrl: profile.tokenUrl, pair: profile.pair, swapped: profile.swapped, paletteId: profile.paletteId };
    }
    return { kind: "unset", tokenUrl: UNSET_PROFILE_TOKEN_URL, pair: null, swapped: false, paletteId: null };
  }

  function commentNickTokenHtml(state, comment) {
    const icon = displayedCommentNickIcon(state, comment);
    const paletteAttr = icon.pair && icon.paletteId ? ` data-palette-id="${escapeHtml(icon.paletteId)}"` : "";
    const swappedAttr = icon.pair && icon.swapped ? ` data-palette-swapped="true"` : "";
    return `
      <span class="inline-flex min-w-0 items-center gap-1.5" data-displayed-profile-nickname data-profile-nick-kind="${icon.kind}">
        <img
          data-comment-nick-token
          data-icon-url="${escapeHtml(icon.tokenUrl)}"
          ${paletteAttr}
          ${swappedAttr}
          src="${escapeHtml(icon.tokenUrl)}"
          alt=""
          width="16"
          height="16"
          class="h-4 w-4 shrink-0 object-contain"
        />
        <span class="truncate font-medium text-primary">${escapeHtml(comment.nickname)}</span>
      </span>
    `;
  }

  async function remapCommentNickTokens(root) {
    const profile = readStoredProfileIconState();
    const images = root.querySelectorAll('[data-profile-nick-kind="profile"] [data-comment-nick-token]');
    for (const image of images) {
      if (!(image instanceof HTMLImageElement)) continue;
      const paletteId = image.dataset.paletteId;
      const pair = paletteId ? PROFILE_PALETTES[paletteId] : (profile.stored ? profile.pair : null);
      if (!pair) continue;
      const swapped = image.dataset.paletteSwapped === "true" || (image.dataset.paletteSwapped !== "false" && profile.swapped);
      const tokenUrl = image.dataset.iconUrl;
      if (!tokenUrl) continue;
      try {
        const remapped = await remappedTokenDataUrl(tokenUrl, pair, swapped);
        image.src = remapped;
      } catch {
        // Fallback to unmodified src
      }
    }
  }

  function syncCommentNickIcons(root) {
    const state = root._stsCommentState;
    if (!state) return;
    const profile = readStoredProfileIconState();
    root.querySelectorAll("[data-patch-comment-row]").forEach((row) => {
      const commentUserId = row.dataset.commentUserId;
      const nickname = row.dataset.commentNickname ?? "";
      const avatarId = row.dataset.commentAvatarId;
      const avatarKind = row.dataset.commentAvatarKind;
      const paletteId = row.dataset.commentPaletteId;
      const paletteSwapped = row.dataset.commentPaletteSwapped === "true";
      const wrap = row.querySelector("[data-displayed-profile-nickname]");
      const img = row.querySelector("[data-comment-nick-token]");
      if (!wrap || !(img instanceof HTMLImageElement)) return;

      if (avatarId && avatarId.trim()) {
        const isBoss = avatarKind === "boss";
        const tokenUrl = isBoss
          ? `/images/sts2/bosses/${avatarId.toLowerCase()}.webp`
          : characterIconUrl(avatarId);
        wrap.dataset.profileNickKind = "profile";
        img.dataset.iconUrl = tokenUrl;
        if (paletteId) {
          img.dataset.paletteId = paletteId;
          img.dataset.paletteSwapped = String(paletteSwapped);
        } else {
          delete img.dataset.paletteId;
          delete img.dataset.paletteSwapped;
        }
        img.src = tokenUrl;
        return;
      }
      if (avatarId === "null") {
        wrap.dataset.profileNickKind = "unset";
        img.dataset.iconUrl = UNSET_PROFILE_TOKEN_URL;
        delete img.dataset.paletteId;
        delete img.dataset.paletteSwapped;
        img.src = UNSET_PROFILE_TOKEN_URL;
        return;
      }

      const isOwner = Boolean(state.userId && state.userId === commentUserId);
      const nickMatch = nickname.trim() === profile.nickname;
      const kind = profile.stored && isOwner && nickMatch ? "profile" : "unset";
      const tokenUrl = kind === "profile" ? profile.tokenUrl : UNSET_PROFILE_TOKEN_URL;
      wrap.dataset.profileNickKind = kind;
      img.dataset.iconUrl = tokenUrl;
      if (kind === "profile" && profile.stored && profile.paletteId) {
        img.dataset.paletteId = profile.paletteId;
        img.dataset.paletteSwapped = String(profile.swapped);
      } else {
        delete img.dataset.paletteId;
        delete img.dataset.paletteSwapped;
      }
      img.src = tokenUrl;
    });
    void remapCommentNickTokens(root);
  }

  function refreshAllCommentNickIcons() {
    document.querySelectorAll("[data-patch-comment-root]").forEach((root) => {
      syncCommentNickIcons(root);
    });
  }

  async function remappedTokenDataUrl(tokenUrl, pair, swapped) {
    const image = await loadImage(tokenUrl);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx || width < 1 || height < 1) return tokenUrl;
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, width, height);
    const shadow = hexToRgb255(swapped ? pair[1] : pair[0]);
    const highlight = hexToRgb255(swapped ? pair[0] : pair[1]);
    remapDuotoneRgba(pixels.data, shadow, highlight);
    ctx.putImageData(pixels, 0, 0);
    return canvas.toDataURL();
  }

  function syncProfileCharacterIcon() {
    const state = readStoredProfileIconState();
    const apply = (src) => {
      document.querySelectorAll("[data-profile-character-icon]").forEach((image) => {
        if (image instanceof HTMLImageElement && image.getAttribute("src") !== src) {
          image.src = src;
        }
      });
    };
    if (!state.pair) {
      apply(state.tokenUrl);
      return;
    }
    void remappedTokenDataUrl(state.tokenUrl, state.pair, state.swapped)
      .then(apply)
      .catch(() => apply(state.tokenUrl));
  }

  function timeoutFetch(operation, input, init = {}, timeoutMs = QUERY_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(`${operation} timed out`), timeoutMs);
    return fetch(input, { ...init, signal: controller.signal }).finally(() => {
      window.clearTimeout(timeout);
    });
  }

  function authStorageKey(config) {
    const host = new URL(config.supabaseUrl).hostname;
    return `sb-${host.split(".")[0]}-auth-token`;
  }

  function readStoredSession(config) {
    try {
      const raw = window.localStorage.getItem(authStorageKey(config));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeStoredSession(config, session) {
    try {
      window.localStorage.setItem(authStorageKey(config), JSON.stringify(session));
    } catch {
      // Ignore storage failures; the current request can still use the session.
    }
  }

  function parseJwtPayload(token) {
    try {
      const payload = token.split(".")[1];
      const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(window.atob(normalized));
    } catch {
      return {};
    }
  }

  function sessionUserId(session) {
    return session?.user?.id ?? parseJwtPayload(session?.access_token ?? "").sub ?? null;
  }

  function normalizeSession(session) {
    if (!session) return null;
    const normalized = session.session ?? session;
    if (!normalized.access_token) return null;
    if (!normalized.expires_at && normalized.expires_in) {
      normalized.expires_at = Math.round(Date.now() / 1000) + Number(normalized.expires_in);
    }
    return normalized;
  }

  async function authRequest(config, path, body) {
    const response = await timeoutFetch(
      `auth.${path}`,
      `${config.supabaseUrl.replace(/\/$/, "")}/auth/v1/${path}`,
      {
        method: "POST",
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${config.supabaseAnonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      AUTH_TIMEOUT_MS,
    );

    if (!response.ok) throw new Error(`Auth request failed: ${response.status}`);
    return response.json();
  }

  async function ensureSession(config) {
    const stored = normalizeSession(readStoredSession(config));
    const now = Math.floor(Date.now() / 1000);
    if (stored?.access_token && stored.expires_at && stored.expires_at > now + 60) {
      return stored;
    }

    if (stored?.refresh_token) {
      try {
        const refreshed = normalizeSession(await authRequest(
          config,
          "token?grant_type=refresh_token",
          { refresh_token: stored.refresh_token },
        ));
        if (refreshed) {
          writeStoredSession(config, refreshed);
          return refreshed;
        }
      } catch {
        // Fall through to an anonymous sign-in below.
      }
    }

    const signedIn = normalizeSession(await authRequest(
      config,
      "signup",
      { data: {}, gotrue_meta_security: {} },
    ));
    if (!signedIn) throw new Error("Anonymous sign-in failed");
    writeStoredSession(config, signedIn);
    return signedIn;
  }

  async function restRequest(config, path, { method = "GET", token, body, headers = {} } = {}) {
    const response = await timeoutFetch(
      `rest.${path}`,
      `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`,
      {
        method,
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${token ?? config.supabaseAnonKey}`,
          "Content-Type": "application/json",
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const error = new Error(`REST request failed: ${response.status}`);
      error.status = response.status;
      try {
        error.body = await response.text();
      } catch {
        error.body = "";
      }
      throw error;
    }
    if (response.status === 204) return null;
    return response.json();
  }

  function commentsPath(threadKey, config) {
    const params = new URLSearchParams({
      select: "*",
      story_id: `eq.${threadKey}`,
      env: `eq.${config.supabaseEnv ?? "production"}`,
      order: "created_at.asc",
    });
    return `comments?${params.toString()}`;
  }

  function commentLikesPath(commentIds, userId) {
    const params = new URLSearchParams({
      select: "comment_id",
      comment_id: `in.(${commentIds.join(",")})`,
    });
    if (userId) params.set("user_id", `eq.${userId}`);
    return `comment_likes?${params.toString()}`;
  }

  function readStoredNickname(defaultNickname) {
    try {
      const raw = window.localStorage.getItem(PROFILE_KEY);
      if (!raw) return defaultNickname;
      const nickname = JSON.parse(raw)?.nickname;
      return typeof nickname === "string" && nickname.trim()
        ? nickname.trim().slice(0, 20)
        : defaultNickname;
    } catch {
      return defaultNickname;
    }
  }

  function patchLineLabel(action) {
    const label = action.dataset.patchLineLabel?.trim();
    if (label) return label;
    const line = action.parentElement?.closest("[data-patch-line-id]");
    if (!line) return action.dataset.patchLineId ?? "";
    const clone = line.cloneNode(true);
    clone.querySelectorAll("[data-patch-line-story-action]").forEach((node) => node.remove());
    return clone.textContent.replace(/\s+/g, " ").trim();
  }

  function patchLineRefs(action) {
    try {
      const parsed = JSON.parse(action.dataset.patchLineRefs ?? "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  const PATCH_LINE_ID_ALIASES = {
    "v0.100.0:line-001-text-qgkkr7": "v0.100.0:line-007-card-prepared",
  };

  const PATCH_LINE_ANCHOR_ALIASES = {
    "patch-line-v0-100-0-line-001-text-qgkkr7": "patch-line-v0-100-0-line-007-card-prepared",
  };

  function openStoryComposer(action, config) {
    const text = copy();
    const rawPatchLineId = action.dataset.patchLineId;
    const patchLineId = PATCH_LINE_ID_ALIASES[rawPatchLineId] ?? rawPatchLineId;
    const patchId = action.dataset.patchId;
    if (!patchLineId || !patchId) return;

    document.querySelector("[data-static-story-composer]")?.remove();
    const overlay = document.createElement("div");
    overlay.dataset.staticStoryComposer = "";
    overlay.className = "fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-3 py-6 backdrop-blur-sm";
    overlay.innerHTML = `
      <form data-static-story-form class="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg border border-border bg-background shadow-2xl" role="dialog" aria-modal="true" aria-label="${escapeHtml(text.storyTitle)}">
        <div class="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <h2 class="text-sm font-semibold">${escapeHtml(text.storyTitle)}</h2>
          <button type="button" data-static-story-close class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground" title="${escapeHtml(text.storyClose)}" aria-label="${escapeHtml(text.storyClose)}">×</button>
        </div>
        <div class="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <textarea data-static-story-sentence maxlength="120" rows="3" required minlength="2" placeholder="${escapeHtml(text.storyPlaceholder)}" class="min-h-24 w-full resize-none rounded-md border border-border/70 bg-background/60 px-3 py-2 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40"></textarea>
          <div class="flex items-center gap-2">
            <input data-static-story-nickname type="text" maxlength="20" required value="${escapeHtml(readStoredNickname(text.defaultNickname))}" placeholder="${escapeHtml(text.storyNickname)}" class="h-8 min-w-0 flex-1 rounded-md border border-border/60 bg-background/50 px-2.5 text-xs text-muted-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/40" />
            <span data-static-story-count class="shrink-0 text-[11px] tabular-nums text-muted-foreground">0/120</span>
          </div>
          <div class="rounded-md border border-primary/20 bg-primary/[0.035] px-3 py-2.5">
            <span class="block text-[11px] font-medium text-primary">${escapeHtml(patchId)}</span>
            <span class="mt-1 block text-xs leading-relaxed text-foreground">${escapeHtml(patchLineLabel(action))}</span>
          </div>
          <p data-static-story-error class="hidden text-[11px] text-amber-300"></p>
        </div>
        <div class="flex items-center justify-end border-t border-border/60 px-4 py-3">
          <button data-static-story-submit type="submit" class="inline-flex h-9 items-center gap-2 rounded-md border border-[#fb923c]/35 bg-[#fb923c]/10 px-3 text-xs font-medium text-[#fb923c] transition-colors hover:bg-[#fb923c]/16 hover:text-[#fed7aa] disabled:opacity-30">${escapeHtml(text.storySubmit)}</button>
        </div>
      </form>
    `;

    const close = () => {
      window.removeEventListener("keydown", onKeyDown);
      overlay.remove();
    };
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay || event.target.closest("[data-static-story-close]")) close();
    });
    const onKeyDown = (event) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);

    const sentenceInput = overlay.querySelector("[data-static-story-sentence]");
    const count = overlay.querySelector("[data-static-story-count]");
    sentenceInput.addEventListener("input", () => {
      count.textContent = `${sentenceInput.value.length}/120`;
    });

    overlay.querySelector("[data-static-story-form]").addEventListener("submit", async (event) => {
      event.preventDefault();
      const nicknameInput = overlay.querySelector("[data-static-story-nickname]");
      const submit = overlay.querySelector("[data-static-story-submit]");
      const error = overlay.querySelector("[data-static-story-error]");
      const sentence = sentenceInput.value.trim();
      const nickname = nicknameInput.value.trim().slice(0, 20);
      if (sentence.length < 2 || !nickname || submit.disabled) return;

      submit.disabled = true;
      submit.textContent = text.storySubmitting;
      error.classList.add("hidden");
      try {
        if (!config) throw new Error("Missing database config");
        const session = await ensureSession(config);
        const refs = patchLineRefs(action);
        const primaryRef = refs[0];
        const linkedEntities = refs.slice(1).map((ref) => ({
          entityType: ref.type,
          entityId: ref.id,
          label: ref.label,
        }));
        const profileState = readStoredProfileIconState();
        const authorToken = profileState.stored ? {
          avatar_id: profileState.avatarId,
          avatar_kind: profileState.avatarKind,
          palette_id: profileState.paletteId,
          palette_swapped: profileState.swapped,
        } : {
          avatar_id: null,
          avatar_kind: null,
          palette_id: null,
          palette_swapped: false,
        };
        await restRequest(config, "community_stories?select=*", {
          method: "POST",
          token: session.access_token,
          headers: { Prefer: "return=representation" },
          body: {
            user_id: sessionUserId(session),
            nickname,
            sentence,
            game: "sts2",
            entity_type: primaryRef?.type ?? null,
            entity_id: primaryRef?.id ?? null,
            patch_line_id: patchLineId,
            source: patchId,
            tags: [],
            linked_entities: linkedEntities,
            env: config.supabaseEnv ?? "production",
            ...authorToken,
          },
        });
        close();
      } catch {
        error.textContent = text.storyUnavailable;
        error.classList.remove("hidden");
        submit.disabled = false;
        submit.textContent = text.storySubmit;
      }
    });

    document.body.appendChild(overlay);
    sentenceInput.focus();
  }

  function mountStoryActions(config) {
    if (!document.querySelector("[data-patch-line-story-action]")) return;
    document.addEventListener("click", (event) => {
      const action = event.target.closest("[data-patch-line-story-action]");
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      openStoryComposer(action, config);
    });
  }

  function commentContent(comment) {
    if (Array.isArray(comment.content_blocks) && comment.content_blocks.length > 0) {
      return comment.content_blocks.map((block) => {
        if (block.type === "text") return block.text ?? "";
        if (block.type === "entity") return block.displayText ?? "";
        if (block.type === "keyword") return block.text ?? "";
        return "";
      }).join("");
    }
    return comment.content ?? "";
  }

  function renderUnavailable(root) {
    root.innerHTML = `
      <div class="flex flex-col items-center justify-center gap-1.5 py-3 text-center">
        <img
          src="/images/sts2/powers/battleworn_dummy_time_limit_power.webp"
          alt=""
          width="32"
          height="32"
          aria-hidden="true"
          class="object-contain opacity-90"
        />
        <span class="text-xs font-semibold text-amber-300">
          ${escapeHtml(copy().unavailableTitle)}
        </span>
      </div>
    `;
  }

  function renderLoading(root) {
    root.innerHTML = `
      <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>${escapeHtml(copy().loading)}</span>
      </div>
    `;
  }

  function renderComments(root, state) {
    root._stsCommentState = state;
    const text = copy();
    if (root.dataset.commentDensity === "inline") {
      const rows = state.comments.map((comment) => `
        <li data-patch-comment-row class="flex items-center gap-2 py-0.5 text-xs leading-5">
          <span class="min-w-0 flex-1 break-words text-foreground/90">${renderText(commentContent(comment))}</span>
          <span class="shrink-0 text-[10px] text-primary">${escapeHtml(comment.nickname ?? "")}</span>
        </li>
      `).join("");
      root.innerHTML = `
        ${rows ? `<ul class="space-y-0.5">${rows}</ul>` : ""}
        <form data-comment-form class="mt-1 flex items-center gap-2">
          <input data-comment-nickname type="hidden" value="${escapeHtml(state.nickname)}" />
          <input data-comment-content type="text" maxlength="${COMMENT_MAX_CHARS}" placeholder="${escapeHtml(text.placeholder)}" class="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground" />
          <button type="submit" class="shrink-0 text-[10px] font-semibold text-primary">${escapeHtml(text.submit)}</button>
        </form>
      `;
      return;
    }
    const commentsHtml = state.comments.length === 0
      ? `<p class="text-xs text-muted-foreground">${escapeHtml(text.empty)}</p>`
      : `
        <ul class="space-y-3">
          ${state.comments.map((comment) => {
            const likeCount = state.likeCounts.get(comment.id) ?? 0;
            const liked = state.liked.has(comment.id);
            const canDelete = state.userId && state.userId === comment.user_id;
            return `
              <li
                class="rounded-lg border border-border/50 bg-card/20 px-3 py-2.5 text-sm"
                data-patch-comment-row
                data-comment-user-id="${escapeHtml(comment.user_id ?? "")}"
                data-comment-nickname="${escapeHtml(comment.nickname ?? "")}"
                data-comment-avatar-id="${escapeHtml(comment.avatar_id ?? "")}"
                data-comment-avatar-kind="${escapeHtml(comment.avatar_kind ?? "")}"
                data-comment-palette-id="${escapeHtml(comment.palette_id ?? "")}"
                data-comment-palette-swapped="${Boolean(comment.palette_swapped)}"
              >
                <div class="flex items-center gap-2">
                  ${commentNickTokenHtml(state, comment)}
                  <span class="text-[10px] text-muted-foreground">${new Date(comment.created_at).toLocaleDateString(serviceLocale() === "ko" ? "ko-KR" : "en-US")}</span>
                  <button data-comment-like="${escapeHtml(comment.id)}" class="flex items-center gap-0.5 text-[10px] text-muted-foreground transition-all">
                    <img src="/images/relics/runic-dodecahedron.webp" alt="${escapeHtml(text.likeAlt)}" width="14" height="14" class="transition-all ${liked ? "" : "opacity-40 grayscale"}" />
                    ${likeCount > 0 ? `<span>${likeCount}</span>` : ""}
                  </button>
                  ${canDelete ? `<button data-comment-delete="${escapeHtml(comment.id)}" class="text-[10px] text-muted-foreground hover:text-red-400">${escapeHtml(text.delete)}</button>` : ""}
                </div>
                <div class="mt-1.5 whitespace-pre-wrap break-words leading-relaxed text-muted-foreground">${renderText(commentContent(comment))}</div>
              </li>
            `;
          }).join("")}
        </ul>
      `;

    root.innerHTML = `
      ${commentsHtml}
      <form data-comment-form class="space-y-2">
        <input
          data-comment-nickname
          type="text"
          placeholder="${escapeHtml(text.nicknamePlaceholder)}"
          value="${escapeHtml(state.nickname)}"
          maxlength="20"
          class="w-full rounded bg-zinc-800 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50"
        />
        <textarea
          data-comment-content
          placeholder="${escapeHtml(text.placeholder)}"
          rows="4"
          minlength="${COMMENT_MIN_CHARS}"
          maxlength="${COMMENT_MAX_CHARS}"
          class="min-h-[6.5rem] max-h-48 w-full resize-y rounded bg-zinc-800 px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50"
        ></textarea>
        <div class="flex items-center justify-between gap-3">
          <span data-comment-count class="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">0/${COMMENT_MAX_CHARS}</span>
          <button
            type="submit"
            class="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-primary disabled:opacity-60"
          >
            ${escapeHtml(state.submitting ? "..." : text.submit)}
          </button>
        </div>
      </form>
    `;
    void remapCommentNickTokens(root);
  }

  async function loadState(config, threadKey) {
    const comments = await restRequest(config, commentsPath(threadKey, config));
    const session = normalizeSession(readStoredSession(config));
    const userId = sessionUserId(session);
    const commentIds = comments.map((comment) => comment.id);
    const likeCounts = new Map();
    const liked = new Set();

    if (commentIds.length > 0) {
      const likes = await restRequest(config, commentLikesPath(commentIds));
      for (const row of likes ?? []) {
        likeCounts.set(row.comment_id, (likeCounts.get(row.comment_id) ?? 0) + 1);
      }

      if (userId) {
        const ownLikes = await restRequest(config, commentLikesPath(commentIds, userId), {
          token: session.access_token,
        });
        for (const row of ownLikes ?? []) {
          liked.add(row.comment_id);
        }
      }
    }

    return {
      comments,
      likeCounts,
      liked,
      userId,
      nickname: readStoredNickname(copy().defaultNickname),
      submitting: false,
    };
  }

  async function mountRoot(root, config) {
    const threadKey = root.dataset.threadKey;
    if (!threadKey) return;

    let state;
    const reload = async () => {
      renderLoading(root);
      state = await loadState(config, threadKey);
      renderComments(root, state);
      syncCommentCounter(root);
    };

    root.addEventListener("input", (event) => {
      if (event.target.closest("[data-comment-content]")) syncCommentCounter(root);
    });

    root.addEventListener("submit", async (event) => {
      const form = event.target.closest("[data-comment-form]");
      if (!form) return;

      event.preventDefault();
      const contentInput = form.querySelector("[data-comment-content]");
      const nicknameInput = form.querySelector("[data-comment-nickname]");
      const content = contentInput?.value.trim() ?? "";
      const nickname = (nicknameInput?.value.trim() || copy().defaultNickname).slice(0, 20);
      if (
        content.length < COMMENT_MIN_CHARS
        || content.length > COMMENT_MAX_CHARS
        || state?.submitting
      ) return;

      state.submitting = true;
      renderComments(root, state);

      try {
        const session = await ensureSession(config);
        const profileState = readStoredProfileIconState();
        const authorToken = profileState.stored ? {
          avatar_id: profileState.avatarId,
          avatar_kind: profileState.avatarKind,
          palette_id: profileState.paletteId,
          palette_swapped: profileState.swapped,
        } : {
          avatar_id: null,
          avatar_kind: null,
          palette_id: null,
          palette_swapped: false,
        };
        await restRequest(config, "comments?select=*", {
          method: "POST",
          token: session.access_token,
          headers: { Prefer: "return=representation" },
          body: {
            story_id: threadKey,
            user_id: sessionUserId(session),
            nickname,
            content,
            env: config.supabaseEnv ?? "production",
            ...authorToken,
          },
        });
        await reload();
      } catch {
        renderUnavailable(root);
      }
    });

    root.addEventListener("click", async (event) => {
      const likeButton = event.target.closest("[data-comment-like]");
      const deleteButton = event.target.closest("[data-comment-delete]");
      if (!likeButton && !deleteButton) return;

      try {
        const session = await ensureSession(config);
        if (likeButton) {
          const commentId = likeButton.dataset.commentLike;
          if (!commentId) return;
          if (state.liked.has(commentId)) {
            const params = new URLSearchParams({
              comment_id: `eq.${commentId}`,
              user_id: `eq.${sessionUserId(session)}`,
            });
            await restRequest(config, `comment_likes?${params.toString()}`, {
              method: "DELETE",
              token: session.access_token,
            });
          } else {
            await restRequest(config, "comment_likes", {
              method: "POST",
              token: session.access_token,
              body: { comment_id: commentId, user_id: sessionUserId(session) },
            });
          }
        }

        if (deleteButton) {
          const commentId = deleteButton.dataset.commentDelete;
          if (!commentId) return;
          const params = new URLSearchParams({ id: `eq.${commentId}` });
          await restRequest(config, `comments?${params.toString()}`, {
            method: "DELETE",
            token: session.access_token,
          });
        }

        await reload();
      } catch {
        renderUnavailable(root);
      }
    });

    try {
      await reload();
    } catch {
      renderUnavailable(root);
    }
  }

  function main() {
    const onProfileIconChange = () => {
      syncProfileCharacterIcon();
      refreshAllCommentNickIcons();
    };
    onProfileIconChange();
    window.addEventListener("storage", (event) => {
      if (event.key === null || event.key === PROFILE_KEY) onProfileIconChange();
    });
    window.addEventListener(PROFILE_CHANGE_EVENT, onProfileIconChange);

    const config = readConfig();
    mountStoryActions(config);

    const rawHash = window.location.hash.replace(/^#/, "");
    if (rawHash && PATCH_LINE_ANCHOR_ALIASES[rawHash]) {
      const canonicalAnchor = PATCH_LINE_ANCHOR_ALIASES[rawHash];
      window.history.replaceState(null, "", `#${canonicalAnchor}`);
      const targetEl = document.getElementById(canonicalAnchor);
      if (targetEl) {
        setTimeout(() => targetEl.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
      }
    }

    const roots = Array.from(document.querySelectorAll("[data-patch-comment-root]"))
      .filter((root) => !("richCommentMounted" in root.dataset));
    const pageRoots = roots.filter((root) => !root.closest("[data-colorful-philosophers-card]"));
    const reelRoots = roots.filter((root) => root.closest("[data-colorful-philosophers-card]"));

    mountCourier(config);
    if (!config) {
      pageRoots.forEach(renderUnavailable);
      bindReelReactions(null);
      return;
    }

    pageRoots.forEach((root) => {
      mountRoot(root, config);
    });

    const mountVisibleReel = () => {
      reelRoots.forEach((root) => {
        const card = root.closest("[data-colorful-philosophers-card]");
        if (!card?.classList.contains("pointer-events-auto")) return;
        if (root.dataset.cpCommentMounted === "true") return;
        root.dataset.cpCommentMounted = "true";
        mountRoot(root, config);
      });
    };
    mountVisibleReel();
    document.addEventListener("cp-reel-show", mountVisibleReel);
    bindReelReactions(config);
    void refreshLiveReels(config);
  }

  function courierToken(storyId) {
    if (storyId.startsWith("neowsletter:")) return "/images/sts2/ancients/neow.webp";
    if (storyId.startsWith("sts2-patch:")) return "/images/sts2/nav/patch_notes_icon.png";
    if (storyId.startsWith("community:")) return "/images/bone_tea.png";
    const codex = storyId.split(":");
    if (storyId.startsWith("sts2-codex:") || storyId.startsWith("sts1-codex:")) {
      const tokens = {
        card: "/images/sts2/nav/stats_cards.png",
        relic: "/images/sts2/relics/bing_bong.webp",
        potion: "/images/sts2/potions/potion_shaped_rock.webp",
        power: "/images/sts2/nav/unmovable_power_beta.webp",
        monster: "/images/sts2/nav/happy_cultist.png",
        event: "/images/sts2/nav/question_mark.png",
        ancient: "/images/sts2/nav/stats_ancients.png",
      };
      return tokens[codex[1]] || "/images/sts2/nav/stats_cards.png";
    }
    const tokens = {
      "colorful-philosophers": "/images/sts2/modifiers/draft.webp",
      "c-c-c-combo": "/images/sts2/badges/ccccombo.webp",
      transfigure: "/images/sts2/relics/astrolabe.webp",
      "chemical-x": "/images/sts2/relics/chemical_x.webp",
      "this-or-that": "/images/sts2/relics/choices_paradox.webp",
      "favorite-tournament": "/images/sts2/potions/fortifier.webp",
      pagestorm: "/images/sts2/powers/pagestorm_power.webp",
      defragment: "/images/sts2/powers/focus_power.webp",
      "decisions-decisions": "/images/sts2/powers/buffer_power.webp",
      "history-course": "/images/sts2/relics/history_course.webp",
    };
    return tokens[codex[0]] || "/images/sts2/relics/the_courier.webp";
  }

  function courierHref(storyId, commentId) {
    const anchor = `#history-comment-${commentId}`;
    if (storyId.startsWith("sts2-patch:")) return `/patches/${storyId.slice("sts2-patch:".length)}${anchor}`;
    if (storyId.startsWith("neowsletter:")) {
      const [, month, claim] = storyId.split(":");
      return `/patches/neowsletters/${month}#claim-${claim || ""}`;
    }
    if (storyId.startsWith("sts2-codex:") || storyId.startsWith("sts1-codex:")) {
      const [, type, id] = storyId.split(":");
      const paths = {
        card: "/compendium/cards",
        relic: "/compendium/relics",
        potion: "/compendium/potions",
        power: "/compendium/powers",
        enchantment: "/compendium/enchantments",
        affliction: "/compendium/enchantments",
        monster: "/compendium/monsters",
        event: "/compendium/events",
        ancient: "/compendium/ancients",
        epoch: "/compendium/epochs",
        character: "/compendium/characters",
        keyword: "/compendium/keywords",
        badge: "/compendium/badges",
        modifier: "/compendium/modifiers",
        ascension: "/compendium/ascensions",
        encounter: "/compendium/encounters",
      };
      return `${paths[type] || "/compendium"}/${encodeURIComponent(String(id || "").toLowerCase())}${anchor}`;
    }
    const [service, id] = storyId.split(":");
    const paths = {
      "colorful-philosophers": "/colorful-philosophers",
      "c-c-c-combo": "/c-c-c-combo",
      transfigure: "/transfigure",
      "chemical-x": "/chemical-x",
      "this-or-that": "/this-or-that",
      "favorite-tournament": "/this-or-that/tournament",
      pagestorm: "/pagestorm",
      defragment: "/defragment",
      "decisions-decisions": "/decisions-decisions",
      "history-course": "/history-course",
      community: "/",
    };
    const path = paths[service];
    if (!path || !id) return `/${anchor}`;
    if (service === "community") return `/${anchor}`;
    return `${path}/${id}${anchor}`;
  }

  function mountCourier(config) {
    const root = document.createElement("div");
    root.id = "sts-courier-root";
    document.body.appendChild(root);
    const enabled = window.localStorage.getItem("sts-courier-enabled") !== "0";
    const token = "/images/sts2/relics/the_courier.webp";
    const place = (node) => {
      root.replaceChildren(node);
    };
    const tokenButton = (label) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", label);
      button.title = label;
      button.style.cssText = "position:fixed;bottom:12px;left:12px;z-index:40;border-radius:999px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.7);padding:4px;opacity:.6";
      button.innerHTML = `<img src="${token}" alt="" width="18" height="18" style="display:block;width:18px;height:18px;object-fit:contain" />`;
      button.addEventListener("click", () => {
        window.localStorage.setItem("sts-courier-enabled", "1");
        window.location.reload();
      });
      return button;
    };
    if (!enabled) {
      place(tokenButton("최신 댓글 보기 켜기"));
      return;
    }
    const skeleton = document.createElement("div");
    skeleton.setAttribute("aria-busy", "true");
    skeleton.style.cssText = "position:fixed;bottom:12px;left:12px;z-index:40;height:26px;width:11rem;border-radius:999px;border:1px solid rgba(255,255,255,.1);background-image:linear-gradient(100deg,rgba(255,255,255,.05) 20%,rgba(255,255,255,.38) 50%,rgba(255,255,255,.05) 80%);background-size:220% 100%;animation:courier-shimmer 1s linear infinite";
    if (!document.getElementById("sts-courier-motion")) {
      const style = document.createElement("style");
      style.id = "sts-courier-motion";
      style.textContent = "@keyframes courier-shimmer{0%{background-position:120% 0}100%{background-position:-120% 0}}@keyframes courier-fade{from{opacity:0}to{opacity:1}}";
      document.head.appendChild(style);
    }
    place(skeleton);
    if (!config) {
      root.replaceChildren();
      return;
    }
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    restRequest(config, `comments?select=id,story_id,content,created_at&env=eq.${config.supabaseEnv}&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=12`)
      .then((rows) => {
        const items = (Array.isArray(rows) ? rows : []).flatMap((row) => {
          const text = String(row.content || "").replace(/\[[^\]]+\]/g, " ").replace(/\s+/g, " ").trim();
          if (!row.id || !row.story_id || !text) return [];
          return [{ id: row.id, storyId: row.story_id, text }];
        });
        if (items.length === 0) {
          root.replaceChildren();
          return;
        }
        let index = 0;
        let paused = false;
        const bar = document.createElement("div");
        bar.style.cssText = "position:fixed;bottom:12px;left:12px;z-index:40;display:flex;max-width:min(28rem,calc(100vw - 1.5rem));align-items:center;gap:8px;border-radius:999px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.75);padding:4px 8px;font-size:12px;color:#d4d4d8";
        const link = document.createElement("a");
        link.style.cssText = "display:flex;min-width:0;align-items:center;gap:6px;overflow:hidden;color:inherit;text-decoration:none;animation:courier-fade 300ms ease";
        const token = document.createElement("img");
        token.alt = "";
        token.width = 16;
        token.height = 16;
        token.style.cssText = "width:16px;height:16px;object-fit:contain;flex:none";
        const text = document.createElement("span");
        text.style.cssText = "min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
        link.append(token, text);
        const hide = document.createElement("button");
        hide.type = "button";
        hide.textContent = "×";
        hide.setAttribute("aria-label", "최신 댓글 보기 끄기");
        hide.style.cssText = "border:0;background:transparent;color:#71717a;cursor:pointer";
        hide.addEventListener("click", () => {
          window.localStorage.setItem("sts-courier-enabled", "0");
          place(tokenButton("최신 댓글 보기 켜기"));
        });
        const paint = () => {
          const item = items[index % items.length];
          link.href = courierHref(String(item.storyId), item.id);
          token.src = courierToken(String(item.storyId));
          text.textContent = item.text;
          link.style.animation = "none";
          void link.offsetWidth;
          link.style.animation = "courier-fade 300ms ease";
        };
        paint();
        bar.append(link, hide);
        bar.addEventListener("mouseenter", () => { paused = true; });
        bar.addEventListener("mouseleave", () => { paused = false; });
        place(bar);
        window.setInterval(() => {
          if (paused || document.hidden || items.length < 2) return;
          index = (index + 1) % items.length;
          paint();
        }, 8000);
      })
      .catch(() => {
        root.replaceChildren();
      });
  }

  async function refreshLiveReels(config) {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const posts = await restRequest(
        config,
        `colorful_philosopher_posts?select=id,name_ko,body,image_url,week_start&env=eq.${config.supabaseEnv}&week_start=lte.${today}&order=week_start.desc&limit=24`,
      );
      const stack = document.querySelector("[data-colorful-philosophers-preview-stack]");
      if (stack && stack.getAttribute("data-react-managed") !== "true" && Array.isArray(posts)) {
        const seen = new Set(Array.from(stack.querySelectorAll("[data-cp-id]")).map((node) => node.getAttribute("data-cp-id")));
        posts.forEach((post) => {
          if (!post.id || seen.has(post.id)) return;
          const card = document.createElement("div");
          card.setAttribute("data-colorful-philosophers-card", "");
          card.setAttribute("data-cp-id", post.id);
          card.className = "absolute inset-0 w-full opacity-0 pointer-events-none";
          const image = post.image_url || "/images/sts2/modifiers/draft.webp";
          card.innerHTML = `<div class="rounded-xl border border-white/10 bg-black/35 px-4 py-4"><div class="flex items-center gap-4"><img src="${escapeHtml(image)}" alt="" width="72" height="72" class="object-contain" /><span class="min-w-0"><span class="block truncate font-service text-lg font-semibold text-primary">${escapeHtml(post.name_ko || "")}</span><span class="mt-1 line-clamp-3 block text-sm text-zinc-300">${escapeHtml(post.body || "")}</span></span></div></div>`;
          stack.appendChild(card);
        });
        document.dispatchEvent(new Event("cp-reel-show"));
      }
    } catch {
      // Keep the baked reel if the browser cannot reach the database.
    }

    try {
      const figures = await restRequest(
        config,
        `transfigure_posts?select=id,title,nickname&env=eq.${config.supabaseEnv}&order=created_at.desc&limit=15`,
      );
      const stack = document.querySelector("[data-transfigure-preview-stack]");
      if (!stack || stack.getAttribute("data-react-managed") === "true" || !Array.isArray(figures)) return;
      const template = stack.querySelector("[data-transfigure-card]");
      if (!template) return;
      const seen = new Set(Array.from(stack.querySelectorAll("[data-transfigure-id]")).map((node) => node.getAttribute("data-transfigure-id")));
      figures.forEach((post) => {
        if (!post.id || seen.has(post.id)) return;
        const card = template.cloneNode(true);
        card.setAttribute("data-transfigure-id", post.id);
        card.setAttribute("data-href", `/transfigure/${post.id}`);
        card.className = "absolute inset-0 w-full opacity-0 pointer-events-none";
        const title = card.querySelector("h3, h2, .font-semibold");
        if (title && post.title) title.textContent = post.title;
        stack.appendChild(card);
      });
    } catch {
      // Keep the baked transfigure reel.
    }
  }

  function bindReelReactions(config) {
    document.querySelectorAll("[data-cp-reaction]").forEach((button) => {
      if (button.dataset.cpBound === "true") return;
      button.dataset.cpBound = "true";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const stack = button.closest("[data-colorful-philosophers-preview-stack]");
        if (!config || stack?.getAttribute("data-react-managed") === "true") return;
        void applyStaticReaction(config, button);
      });
    });
  }

  async function applyStaticReaction(config, button) {
    const postId = button.dataset.cpPost;
    const resourceType = button.dataset.cpType;
    const resourceId = button.dataset.cpResource;
    const gameVersion = button.dataset.cpVersion;
    const kind = button.dataset.cpKind;
    if (!postId || !resourceType || !resourceId || !gameVersion || !kind) return;
    const session = await ensureSession(config);
    const userId = sessionUserId(session);
    if (!userId) return;
    const key = `sts-resource-reaction:${resourceType}:${resourceId}:${gameVersion}`;
    const stored = window.localStorage.getItem(key);
    const previous = stored === "buff" || stored === "nerf" || stored === "rework" ? stored : null;
    const next = previous === kind ? null : kind;
    const filter = `env=eq.${config.supabaseEnv}&resource_type=eq.${resourceType}&resource_id=eq.${resourceId}&game_version=eq.${gameVersion}&user_id=eq.${userId}`;
    try {
      if (next === null) {
        await restRequest(config, `resource_reactions?${filter}`, { method: "DELETE", token: session.access_token, headers: { Prefer: "return=minimal" } });
      } else if (previous) {
        await restRequest(config, `resource_reactions?${filter}`, { method: "PATCH", token: session.access_token, body: { kind: next }, headers: { Prefer: "return=minimal" } });
      } else {
        await restRequest(config, "resource_reactions", { method: "POST", token: session.access_token, body: { env: config.supabaseEnv, resource_type: resourceType, resource_id: resourceId, game_version: gameVersion, user_id: userId, kind: next }, headers: { Prefer: "return=minimal" } });
      }
    } catch {
      return;
    }
    if (next) window.localStorage.setItem(key, next);
    else window.localStorage.removeItem(key);
    const card = button.closest("[data-colorful-philosophers-card]");
    card?.querySelectorAll("[data-cp-reaction]").forEach((other) => {
      const count = other.querySelector("[data-cp-count]");
      const otherKind = other.dataset.cpKind;
      if (!count || !otherKind) return;
      let value = Number(count.textContent) || 0;
      if (previous === otherKind) value = Math.max(0, value - 1);
      if (next === otherKind) value += 1;
      count.textContent = String(value);
      other.setAttribute("aria-pressed", next === otherKind ? "true" : "false");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main, { once: true });
  } else {
    main();
  }
})();
