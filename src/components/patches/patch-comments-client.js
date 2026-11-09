(() => {
  const CONFIG_ID = "sts-patch-comments-config";
  const PROFILE_KEY = "sts-user-profile";
  const QUERY_TIMEOUT_MS = 8000;
  const WRITE_PAUSE_MAX_WAIT_MS = 90000;
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
      reloadPage: "새로 고침",
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
      reloadPage: "Refresh page",
      storyTitle: "Write story from this change",
      storyPlaceholder: "Share the story this change brought to mind",
      storyNickname: "Nickname",
      storySubmit: "Write",
      storySubmitting: "...",
      storyClose: "Close",
      storyUnavailable: "Could not save the story",
    },
  };

  /**
   * The page config scripts/build-patch-worker.tsx bakes: `{ dataEnv }` only (step 6,
   * docs/supabase-exit/STEP6_PLAN.md 1.1). Every data call goes to the same-origin /api,
   * so a missing or broken config is `{}` (the production data env), never a disabled page.
   */
  function readConfig() {
    const element = document.getElementById(CONFIG_ID);
    if (!element?.textContent) return {};

    try {
      const parsed = JSON.parse(element.textContent);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
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

  // The Supabase session under supabase-js's localStorage key stays (docs/SUPABASE_EXIT_PLAN.md 5.3):
  // it is read to claim the same uid, and a session the claim answers is written there, so a
  // rollback finds the same identity. It is never removed. No Supabase URL is baked any more:
  // the key is the one already stored, or one made from the host of the token's `iss`.
  const SUPABASE_AUTH_KEY = /^sb-[a-z0-9]+-auth-token$/;

  function storedAuthKey() {
    try {
      const store = window.localStorage;
      for (let index = 0; index < store.length; index += 1) {
        const key = store.key(index);
        if (key && SUPABASE_AUTH_KEY.test(key)) return key;
      }
    } catch {
      // No storage: nothing is stored.
    }
    return null;
  }

  function issuerAuthKey(session) {
    try {
      const key = `sb-${new URL(parseJwtPayload(session?.access_token ?? "").iss).hostname.split(".")[0]}-auth-token`;
      return SUPABASE_AUTH_KEY.test(key) ? key : null;
    } catch {
      return null;
    }
  }

  function readStoredSession() {
    try {
      const key = storedAuthKey();
      const raw = key ? window.localStorage.getItem(key) : null;
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeStoredSession(session) {
    const key = session ? storedAuthKey() ?? issuerAuthKey(session) : null;
    if (!key) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(session));
    } catch {
      // Ignore storage failures; the cookie still carries the identity.
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

  function openStoryComposer(action) {
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
        // docs/supabase-exit/STEP1_DESIGN.md 9.7: the Worker fills the user id, env and game.
        await apiWriteAsUser("/api/write/stories", {
          method: "POST",
          body: {
            nickname,
            sentence,
            entityType: primaryRef?.type ?? null,
            entityId: primaryRef?.id ?? null,
            patchLineId,
            source: patchId,
            linkedEntities,
            author: {
              avatarId: authorToken.avatar_id,
              avatarKind: authorToken.avatar_kind,
              paletteId: authorToken.palette_id,
              paletteSwapped: authorToken.palette_swapped,
            },
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

  function mountStoryActions() {
    if (!document.querySelector("[data-patch-line-story-action]")) return;
    document.addEventListener("click", (event) => {
      const action = event.target.closest("[data-patch-line-story-action]");
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      openStoryComposer(action);
    });
  }

  // Keep ids in sync with src/lib/emote-con.ts. Static fallback only;
  // the rich comment client inserts these through the comment editor.
  const EMOTE_SRC = {
    exclaim: "/images/sts2/ui/emote/exclaim.png",
    skull: "/images/sts2/ui/emote/skull.png",
    thumb_down: "/images/sts2/ui/emote/thumb_down.png",
    slime_sad: "/images/sts2/ui/emote/slime_sad.png",
    question: "/images/sts2/ui/emote/question.png",
    heart: "/images/sts2/ui/emote/heart.png",
    thumb_up: "/images/sts2/ui/emote/thumb_up.png",
    happy_cultist: "/images/sts2/ui/emote/happy_cultist.png",
  };
  const EMOTE_ALT = {
    exclaim: "느낌표",
    skull: "해골",
    thumb_down: "별로",
    slime_sad: "슬라임",
    question: "물음표",
    heart: "하트",
    thumb_up: "엄지",
    happy_cultist: "컬티스트",
  };

  function commentBodyHtml(comment) {
    if (Array.isArray(comment.content_blocks) && comment.content_blocks.length > 0) {
      return comment.content_blocks.map((block) => {
        if (block.type === "text" || block.type === "keyword" || block.type === "text-con") {
          return renderText(block.text ?? "");
        }
        if (block.type === "entity" || block.type === "card-con") {
          return renderText(block.displayText ?? "");
        }
        if (block.type === "emote-con") {
          const src = EMOTE_SRC[block.emoteId];
          if (!src) return "";
          const alt = EMOTE_ALT[block.emoteId] ?? "";
          return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" width="24" height="24" class="mx-0.5 inline-block h-6 w-6 align-middle object-contain" />`;
        }
        return "";
      }).join("");
    }
    return renderText(comment.content ?? "");
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
        <button
          type="button"
          data-storage-reload
          class="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:border-primary/50 hover:bg-primary/15"
        >
          ${escapeHtml(copy().reloadPage)}
        </button>
      </div>
    `;
    root.querySelector("[data-storage-reload]")?.addEventListener("click", () => window.location.reload());
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
          <span class="min-w-0 flex-1 break-words text-foreground/90">${commentBodyHtml(comment)}</span>
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
                <div class="mt-1.5 whitespace-pre-wrap break-words leading-relaxed text-muted-foreground">${commentBodyHtml(comment)}</div>
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

  /**
   * Thread state from /api/read/engagement and /api/me/engagement. A key outside the api rule,
   * a legacy signal or an answer of another version is an outage (renderUnavailable).
   */
  async function loadState(threadKey) {
    if (!THREAD_KEY.test(threadKey)) throw new Error("unavailable");
    const body = await apiRequest(`/api/read/engagement?threads=${threadKey}`);
    const comments = body?.v === 1 ? body.threads?.[threadKey] : undefined;
    if (!Array.isArray(comments)) throw new Error("unavailable");
    const session = normalizeSession(readStoredSession());
    const userId = sessionUserId(session) ?? claimedUid();
    const likeCounts = new Map(comments.map((comment) => [comment.id, Number(comment.like_count) || 0]));
    const liked = new Set();
    // Claim once (never a new sign-up on a read: there is a session or a claimed uid), no token.
    if (userId && comments.length > 0) {
      try {
        await ensureClaimed({ signUp: false });
        const mine = await apiRequest(`/api/me/engagement?threads=${threadKey}`);
        for (const id of mine?.commentLikes?.[threadKey] ?? []) liked.add(id);
      } catch {
        // Hearts stay empty; the comments still show.
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

  async function mountRoot(root) {
    const threadKey = root.dataset.threadKey;
    if (!threadKey) return;

    let state;
    const reload = async () => {
      renderLoading(root);
      state = await loadState(threadKey);
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
        const { result: created, session: writer } = await apiWriteAsUser("/api/write/comments", {
          method: "POST",
          body: {
            threadKey,
            nickname,
            content,
            author: {
              avatarId: authorToken.avatar_id,
              avatarKind: authorToken.avatar_kind,
              paletteId: authorToken.palette_id,
              paletteSwapped: authorToken.palette_swapped,
            },
          },
        });
        // A new session (first write) has other likes: read the thread again for it.
        if (sessionUserId(writer) !== state.userId) {
          await reload();
          return;
        }
        // The answer is the new row: no reload.
        state.comments = [...state.comments, created.comment];
        state.likeCounts.set(created.comment.id, 0);
        state.submitting = false;
        if (contentInput) contentInput.value = "";
        renderComments(root, state);
        syncCommentCounter(root);
      } catch {
        renderUnavailable(root);
      }
    });

    root.addEventListener("click", async (event) => {
      const likeButton = event.target.closest("[data-comment-like]");
      const deleteButton = event.target.closest("[data-comment-delete]");
      if (!likeButton && !deleteButton) return;

      try {
        let writer = null;
        let changedOnServer = false;
        if (likeButton) {
          const commentId = likeButton.dataset.commentLike;
          if (!commentId) return;
          const wasLiked = state.liked.has(commentId);
          const write = await apiWriteAsUser(`/api/write/comment-likes?id=${encodeURIComponent(commentId)}`, {
            method: wasLiked ? "DELETE" : "PUT",
          });
          writer = write.session;
          if (write.result.liked) state.liked.add(commentId);
          else state.liked.delete(commentId);
          const shown = state.likeCounts.get(commentId) ?? 0;
          // Null: committed, but the count could not be read; adjust the shown one.
          state.likeCounts.set(commentId, typeof write.result.count === "number"
            ? write.result.count
            : Math.max(0, shown + (write.result.liked === wasLiked ? 0 : write.result.liked ? 1 : -1)));
        }
        if (deleteButton) {
          const commentId = deleteButton.dataset.commentDelete;
          if (!commentId) return;
          try {
            const write = await apiWriteAsUser(`/api/write/comments?id=${encodeURIComponent(commentId)}`, {
              method: "DELETE",
            });
            writer = write.session;
            state.comments = state.comments.filter((comment) => comment.id !== commentId);
          } catch (error) {
            // Already gone, or not this session's: read the thread again instead of guessing.
            if (error.code !== "not_found") throw error;
            changedOnServer = true;
          }
        }
        // A new session (the first write signed up) has other likes and other own comments.
        if (changedOnServer || (writer && sessionUserId(writer) !== state.userId)) {
          await reload();
          return;
        }
        renderComments(root, state);
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
    mountStoryActions();

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
    const reelTemplate = captureReelTemplate();

    mountCourier(config);
    pageRoots.forEach((root) => {
      mountRoot(root);
    });

    // Re-query each time: refreshLiveReels swaps week cards in after load.
    const mountVisibleReel = () => {
      document.querySelectorAll("[data-colorful-philosophers-card] [data-patch-comment-root]").forEach((root) => {
        if ("richCommentMounted" in root.dataset) return;
        const card = root.closest("[data-colorful-philosophers-card]");
        if (!card?.classList.contains("pointer-events-auto")) return;
        if (root.dataset.cpCommentMounted === "true") return;
        root.dataset.cpCommentMounted = "true";
        mountRoot(root);
      });
    };
    mountVisibleReel();
    document.addEventListener("cp-reel-show", mountVisibleReel);
    syncReelPressed();
    bindReelReactions();
    void refreshLiveReels(reelTemplate).then(mountVisibleReel);
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

  // Static pages know their locale from the path: "/ja/patches/..." -> "/ja".
  function localePrefix() {
    return window.location.pathname.match(/^\/[^/]+(?=\/patches(?:\/|$))/)?.[0] ?? "";
  }

  function courierHref(storyId, commentId) {
    return `${localePrefix()}${courierPath(storyId, commentId)}`;
  }

  function courierPath(storyId, commentId) {
    const anchor = `#history-comment-${commentId}`;
    if (storyId.startsWith("sts2-patch:")) return `/patches/${storyId.slice("sts2-patch:".length)}${anchor}`;
    if (storyId.startsWith("neowsletter:")) {
      const [, month, claim] = storyId.split(":");
      return `/patches/neowsletters/${month}#${claim || ""}`;
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

  // Same contract as src/lib/nav-snapshot.ts (docs/supabase-exit/STEP1_DESIGN.md 8.2). The
  // page-wide object lets this script and the bundled patch scripts share one /api/read/nav
  // request. Step 6 (docs/supabase-exit/STEP6_PLAN.md 1.1): every call is on the api path and a
  // legacy signal is an outage, never a demotion, so `demoted` stays empty; it is kept only for
  // the shape src/lib/runtime-flags.ts declares until WP-Z.
  const API_MARKER_HEADER = "x-slseoun-api";
  const NAV_SNAPSHOT_TTL_MS = 30000;

  function slseounRuntime() {
    window.__slseounRuntime = window.__slseounRuntime || { demoted: new Set() };
    return window.__slseounRuntime;
  }

  // Signed-cookie identity, same contract as src/lib/api-identity.ts and src/lib/identity-cookies.ts
  // (docs/SUPABASE_EXIT_PLAN.md 5.3, docs/supabase-exit/STEP6_PLAN.md WP0). The Worker's HttpOnly
  // cookie carries the uid; the browser never sends a bearer token.
  const IDENTITY_MARKER_KEY = "slseoun-identity";
  const IDENTITY_CLAIM_PATH = "/api/auth/claim";
  let identityClaim = null;

  function claimedUid() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(IDENTITY_MARKER_KEY) || "null");
      return typeof parsed?.uid === "string" ? parsed.uid : null;
    } catch {
      return null;
    }
  }

  function rememberClaim(uid) {
    try {
      window.localStorage.setItem(IDENTITY_MARKER_KEY, JSON.stringify({ uid, at: new Date().toISOString() }));
    } catch {
      // The cookie still works; the next write claims again.
    }
  }

  /** The claim body (ClaimRequest) for a stored session: its tokens, or `{}` with none. */
  function claimBody(session) {
    if (!session?.access_token) return {};
    return session.refresh_token
      ? { access_token: session.access_token, refresh_token: session.refresh_token }
      : { access_token: session.access_token };
  }

  /**
   * POST /api/auth/claim once per page at a time. Errors carry the router `code`; no router
   * answer or a legacy signal is `unavailable`.
   */
  function claimIdentity(body) {
    identityClaim = identityClaim || (async () => {
      const fail = (fields) => Object.assign(new Error(fields.code || "unavailable"), fields);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);
      try {
        let response;
        try {
          response = await fetch(IDENTITY_CLAIM_PATH, {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: JSON.stringify(body),
            credentials: "same-origin",
            signal: controller.signal,
          });
        } catch {
          throw fail({ code: "unavailable" });
        }
        if (response.headers.get(API_MARKER_HEADER) !== "1") {
          void response.body?.cancel().catch(() => undefined);
          throw fail({ code: "unavailable", status: response.status });
        }
        const parsed = await response.json().catch(() => null);
        if (response.status === 409 && parsed?.error === "surface_legacy") throw fail({ code: "unavailable", status: 409 });
        if (!response.ok) throw fail({ code: parsed?.error || `http_${response.status}`, status: response.status });
        if (parsed?.v !== 1 || typeof parsed.uid !== "string") throw fail({ code: "bad_response" });
        rememberClaim(parsed.uid);
        return parsed;
      } finally {
        clearTimeout(timer);
      }
    })().finally(() => {
      identityClaim = null;
    });
    return identityClaim;
  }

  /**
   * Claim with the stored session's tokens. A main Worker before the WP-A refresh path refuses a
   * body with any key but `access_token` as 400 `invalid` (CI deploys this patch Worker first), so
   * a refused body with `refresh_token` is resent once with the access token alone.
   */
  async function claimWithSession(stored) {
    const body = claimBody(stored);
    try {
      return await claimIdentity(body);
    } catch (error) {
      if (!body.refresh_token || error.code !== "invalid") throw error;
      return claimIdentity({ access_token: body.access_token });
    }
  }

  /**
   * The claimed uid. Claims with the stored Supabase session (its access token, expired is fine,
   * and its refresh token, which the Worker uses only when the access token is refused) when this
   * browser has not claimed it yet, or when `force` (the cookie is gone). With no stored session it
   * claims `{}`: the Worker keeps a valid cookie's uid or signs up a new user. A session the Worker
   * answers (a new user, a refreshed one) is stored where supabase-js keeps it.
   *
   * A token claim refused as `token_invalid` (the session could not be refreshed either) claims `{}`
   * once, as supabase-js signs in anew today when its refresh fails: a valid cookie keeps its uid,
   * otherwise a new user. A read passes `signUp: false`, so only a write can make a user.
   */
  async function ensureClaimed({ force = false, signUp = true } = {}) {
    const stored = normalizeSession(readStoredSession());
    const storedUid = sessionUserId(stored);
    const marker = claimedUid();
    if (!force && marker && (!storedUid || storedUid === marker)) return marker;
    let claimed;
    try {
      claimed = await claimWithSession(stored);
    } catch (error) {
      if (!signUp || !stored?.access_token || error.code !== "token_invalid") throw error;
      claimed = await claimIdentity({});
    }
    if (claimed.session) writeStoredSession(normalizeSession(claimed.session));
    return claimed.uid;
  }

  /** The session to report for a write: the stored one when it is the same user. */
  function cookieSession(uid) {
    const stored = normalizeSession(readStoredSession());
    return stored && sessionUserId(stored) === uid ? stored : { user: { id: uid } };
  }

  // Same rules as src/lib/engagement-keys.ts: the Worker refuses other keys.
  const THREAD_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
  const REACTION_PART = { type: /^[a-z_-]{1,32}$/, id: /^[A-Za-z0-9._-]{1,128}$/, version: /^[A-Za-z0-9._-]{1,32}$/ };

  function isReactionTarget(type, id, version) {
    return REACTION_PART.type.test(type) && REACTION_PART.id.test(id) && REACTION_PART.version.test(version);
  }

  /**
   * Same-origin /api call with src/lib/api-client.ts semantics. Errors carry the router's error
   * `code`; no router answer and a legacy signal are `unavailable`, and nothing is resent.
   */
  async function apiRequest(path, init = {}) {
    // 503 write_paused (the step 5 cutover, src/lib/api-client.ts): the write did nothing, so it
    // is sent again after Retry-After, for at most WRITE_PAUSE_MAX_WAIT_MS in all.
    let waited = 0;
    for (;;) {
      try {
        return await apiRequestOnce(path, init);
      } catch (error) {
        if (!error.retryAfterMs || waited + error.retryAfterMs > WRITE_PAUSE_MAX_WAIT_MS) throw error;
        waited += error.retryAfterMs;
        await new Promise((resolve) => setTimeout(resolve, error.retryAfterMs));
      }
    }
  }

  async function apiRequestOnce(path, { method = "GET", body } = {}) {
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);
    const fail = (fields) => Object.assign(new Error(fields.code || "unavailable"), fields);
    try {
      let response;
      try {
        response = await fetch(path, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          credentials: "same-origin",
          signal: controller.signal,
        });
      } catch {
        throw fail({ code: "unavailable" });
      }
      if (response.headers.get(API_MARKER_HEADER) !== "1") {
        // No router answered (a platform error page, or a Worker from before step 1). After a
        // platform 5xx a write may have run, so nothing is resent.
        void response.body?.cancel().catch(() => undefined);
        throw fail({ code: "unavailable", status: response.status });
      }
      const parsed = await response.json().catch(() => null);
      if (response.status === 409 && parsed?.error === "surface_legacy") throw fail({ code: "unavailable", status: 409 });
      if (response.status === 503 && parsed?.error === "write_paused" && method !== "GET") {
        const seconds = Number(response.headers.get("retry-after") || "");
        throw fail({ code: "write_paused", status: 503, retryAfterMs: Math.min(10, Math.max(1, Number.isFinite(seconds) ? seconds : 3)) * 1000 });
      }
      if (!response.ok) throw fail({ code: parsed?.error || `http_${response.status}`, status: response.status });
      return parsed;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * An api write as this browser's user (cookie identity only). `identity_required` (the cookie
   * is gone; the handler did not run) claims again and sends once more. Any other failure,
   * `token_*` included, is the caller's outage. Resolves to { result, session }.
   */
  async function apiWriteAsUser(path, init) {
    let uid = await ensureClaimed();
    try {
      return { result: await apiRequest(path, init), session: cookieSession(uid) };
    } catch (error) {
      if (error.code !== "identity_required") throw error;
      uid = await ensureClaimed({ force: true });
      return { result: await apiRequest(path, init), session: cookieSession(uid) };
    }
  }

  /** The page's data env (`dataEnv` in the config), which the nav snapshot must match. */
  function configEnv(config) {
    return typeof config?.dataEnv === "string" && config.dataEnv ? config.dataEnv : "production";
  }

  /**
   * The shared /api/read/nav snapshot. No router, a legacy signal, another shape or another data
   * env rejects it, and then the nav dots and the courier stay empty (src/lib/nav-snapshot.ts).
   */
  function loadNavSnapshot(expectedEnv) {
    const runtime = slseounRuntime();
    const now = Date.now();
    if (runtime.nav && now - runtime.nav.at < NAV_SNAPSHOT_TTL_MS) return runtime.nav.promise;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);
    const promise = fetch("/api/read/nav", {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      signal: controller.signal,
    }).then(async (response) => {
      if (response.headers.get(API_MARKER_HEADER) !== "1") throw new Error("unavailable");
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error("unavailable");
      if (!body || body.v !== 1 || !Array.isArray(body.courier) || !body.latest || !body.weekly) throw new Error("unavailable");
      if (body.env !== expectedEnv) throw new Error("unavailable");
      return body;
    }).finally(() => clearTimeout(timer));
    runtime.nav = { promise, at: now };
    return promise;
  }

  /** Courier rows from the nav snapshot; none when it is rejected. */
  function courierItems(config) {
    return loadNavSnapshot(configEnv(config)).then(
      (snapshot) => snapshot.courier.map((item) => ({ id: item.id, storyId: item.storyId, text: item.text })),
      () => [],
    );
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
    courierItems(config)
      .then((items) => {
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

  const REEL_SLOT_ORDER = ["topic", "card", "relic", "power"];
  const COMPENDIUM_DETAIL_PATHS = {
    affliction: "/compendium/enchantments",
    ancient: "/compendium/ancients",
    card: "/compendium/cards",
    character: "/compendium/characters",
    enchantment: "/compendium/enchantments",
    encounter: "/compendium/encounters",
    epoch: "/compendium/epochs",
    event: "/compendium/events",
    keyword: "/compendium/keywords",
    monster: "/compendium/monsters",
    potion: "/compendium/potions",
    power: "/compendium/powers",
    relic: "/compendium/relics",
  };

  function reelStack() {
    const stack = document.querySelector("[data-colorful-philosophers-preview-stack]");
    return stack && stack.getAttribute("data-react-managed") !== "true" ? stack : null;
  }

  // Clone before any comment root mounts so fallback cards start pristine.
  function captureReelTemplate() {
    const card = reelStack()?.querySelector("[data-colorful-philosophers-card]");
    return card ? card.cloneNode(true) : null;
  }

  function addDays(value, days) {
    const date = new Date(`${value}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function reelWeekLabel(stack, weekStart) {
    const epoch = Date.parse(`${stack.dataset.cpEpoch || weekStart}T00:00:00Z`);
    const week = Math.floor((Date.parse(`${weekStart}T00:00:00Z`) - epoch) / (7 * 24 * 60 * 60 * 1000)) + 1;
    return (stack.dataset.cpWeekTemplate || "{week}").replace("{week}", String(week));
  }

  function reactionStorageKey(type, id, version) {
    return `sts-resource-reaction:${type}:${id}:${version}`;
  }

  function readStoredReaction(button) {
    const stored = window.localStorage.getItem(
      reactionStorageKey(button.dataset.cpType, button.dataset.cpResource, button.dataset.cpVersion),
    );
    return stored === "buff" || stored === "nerf" || stored === "rework" ? stored : null;
  }

  function syncReelPressed() {
    document.querySelectorAll("[data-colorful-philosophers-card]").forEach((card) => {
      const first = card.querySelector("[data-cp-reaction]");
      if (!first) return;
      const kind = readStoredReaction(first);
      card.querySelectorAll("[data-cp-reaction]").forEach((button) => {
        button.setAttribute("aria-pressed", kind === button.dataset.cpKind ? "true" : "false");
      });
    });
  }

  // Stored names are Korean and English; other locales use the baked game names.
  function reelPostName(post) {
    if (serviceLocale() === "ko") return post.name_ko || "";
    return reelGameNames()[`${post.resource_type}:${post.resource_id}`] || post.name_en || post.name_ko || "";
  }

  function reelGameNames() {
    try {
      return JSON.parse(document.getElementById("sts-cp-game-names")?.textContent || "{}");
    } catch {
      return {};
    }
  }

  function buildFallbackReelCard(template, stack, post) {
    const card = template.cloneNode(true);
    card.setAttribute("data-cp-id", post.id);
    card.setAttribute("data-cp-week-start", post.week_start);
    const art = card.querySelector("[data-cp-art]");
    if (art) {
      const image = post.image_url || "/images/sts2/modifiers/draft.webp";
      const detailPath = COMPENDIUM_DETAIL_PATHS[post.resource_type];
      const imageHtml = `<img src="${escapeHtml(image)}" alt="${escapeHtml(reelPostName(post))}" width="72" height="72" class="object-contain" />`;
      const prefix = localePrefix();
      art.innerHTML = detailPath
        ? `<a href="${prefix}${detailPath}/${encodeURIComponent(String(post.resource_id).toLowerCase())}" class="block shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/70">${imageHtml}</a>`
        : imageHtml;
    }
    const setText = (selector, value) => {
      const node = card.querySelector(selector);
      if (node) node.textContent = value;
    };
    setText("[data-cp-week]", reelWeekLabel(stack, post.week_start));
    setText("[data-cp-dates]", `${post.week_start.slice(5)} – ${addDays(post.week_start, 6).slice(5)}`);
    setText("[data-cp-name]", reelPostName(post));
    setText("[data-cp-body]", post.body || "");
    card.querySelectorAll("[data-cp-reaction]").forEach((button) => {
      delete button.dataset.cpBound;
      button.dataset.cpPost = post.id;
      button.dataset.cpType = post.resource_type;
      button.dataset.cpResource = post.resource_id;
      button.dataset.cpVersion = post.game_version;
      const count = button.querySelector("[data-cp-count]");
      if (count) count.textContent = "0";
    });
    const comments = card.querySelector("[data-cp-comments]");
    if (comments) {
      comments.innerHTML = `<div data-patch-comment-root data-thread-key="colorful-philosophers:${escapeHtml(post.id)}" data-comment-density="inline" class="space-y-3"><div class="h-4 w-24 rounded bg-muted/20" aria-hidden="true"></div></div>`;
    }
    card.classList.remove("opacity-100", "pointer-events-auto", "relative");
    card.classList.add("opacity-0", "pointer-events-none", "absolute", "inset-0");
    return card;
  }

  async function refreshReelWeek(template) {
    const stack = reelStack();
    if (!stack) return;
    const body = await apiRequest("/api/read/colorful-philosophers/reel");
    // Another version is an outage: the baked reel stays.
    if (body?.v !== 1 || !Array.isArray(body.posts)) throw new Error("unavailable");
    const posts = body.posts
      .filter((row) => row.id && row.week_start && row.resource_type && row.resource_id && row.game_version);
    if (posts.length === 0) return;
    const week = String(posts[0].week_start).slice(0, 10);
    const weekPosts = posts
      .map((post) => ({ ...post, week_start: String(post.week_start).slice(0, 10) }))
      .filter((post) => post.week_start === week)
      .sort((left, right) => REEL_SLOT_ORDER.indexOf(left.slot) - REEL_SLOT_ORDER.indexOf(right.slot));
    const wanted = new Set(weekPosts.map((post) => post.id));
    const baked = new Map(
      Array.from(stack.querySelectorAll("[data-colorful-philosophers-card]"))
        .map((card) => [card.getAttribute("data-cp-id"), card]),
    );
    baked.forEach((card, id) => {
      if (!wanted.has(id)) card.remove();
    });
    weekPosts.forEach((post) => {
      const existing = baked.get(post.id);
      if (existing) {
        const body = existing.querySelector("[data-cp-body]");
        if (body && post.body) body.textContent = post.body;
        stack.appendChild(existing);
        return;
      }
      if (template) stack.appendChild(buildFallbackReelCard(template, stack, post));
    });
    document.dispatchEvent(new Event("cp-reel-refresh"));
  }

  async function refreshReelCounts() {
    const buttons = Array.from(document.querySelectorAll("[data-colorful-philosophers-card] [data-cp-reaction]"));
    const ids = Array.from(new Set(buttons.map((button) => button.dataset.cpResource).filter(Boolean)));
    if (ids.length === 0) return;
    const counts = new Map();
    // Totals come from the env the reaction writes go to: the Worker's.
    const targets = Array.from(new Set(buttons
      .filter((button) => isReactionTarget(button.dataset.cpType, button.dataset.cpResource, button.dataset.cpVersion))
      .map((button) => `${button.dataset.cpType}:${button.dataset.cpResource}:${button.dataset.cpVersion}`)));
    // A target outside the api rule, or an answer of another version, keeps the baked counts.
    if (targets.length === 0 || targets.length !== new Set(buttons.map((button) => `${button.dataset.cpType}:${button.dataset.cpResource}:${button.dataset.cpVersion}`)).size) {
      throw new Error("unavailable");
    }
    const body = await apiRequest(`/api/read/engagement?reactions=${targets.slice(0, 64).join(",")}`);
    if (body?.v !== 1 || !body.reactions) throw new Error("unavailable");
    Object.entries(body.reactions).forEach(([target, value]) => counts.set(target, value));
    applyReelCounts(buttons, counts);
  }

  function applyReelCounts(buttons, counts) {
    buttons.forEach((button) => {
      const count = button.querySelector("[data-cp-count]");
      if (!count) return;
      const row = counts.get(`${button.dataset.cpType}:${button.dataset.cpResource}:${button.dataset.cpVersion}`);
      count.textContent = String(row?.[button.dataset.cpKind] ?? 0);
    });
  }

  async function refreshLiveReels(reelTemplate) {
    try {
      await refreshReelWeek(reelTemplate);
    } catch {
      // Keep the baked reel if the browser cannot reach the database.
    }
    syncReelPressed();
    bindReelReactions();
    try {
      await refreshReelCounts();
    } catch {
      // Keep the baked counts.
    }
    // The transfigure reel stays as baked: its rotation script (backstab-transfigure-section.tsx)
    // takes the cards once at load, so cards appended later would never be shown.
  }

  function bindReelReactions() {
    document.querySelectorAll("[data-cp-reaction]").forEach((button) => {
      if (button.dataset.cpBound === "true") return;
      button.dataset.cpBound = "true";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const stack = button.closest("[data-colorful-philosophers-preview-stack]");
        if (stack?.getAttribute("data-react-managed") === "true") return;
        void applyStaticReaction(button);
      });
    });
  }

  async function applyStaticReaction(button) {
    const postId = button.dataset.cpPost;
    const resourceType = button.dataset.cpType;
    const resourceId = button.dataset.cpResource;
    const gameVersion = button.dataset.cpVersion;
    const kind = button.dataset.cpKind;
    if (!postId || !resourceType || !resourceId || !gameVersion || !kind) return;
    // The Worker refuses a target outside the api rule: nothing changes, as a failed write.
    if (!isReactionTarget(resourceType, resourceId, gameVersion)) return;
    const key = `sts-resource-reaction:${resourceType}:${resourceId}:${gameVersion}`;
    const stored = window.localStorage.getItem(key);
    const previous = stored === "buff" || stored === "nerf" || stored === "rework" ? stored : null;
    const next = previous === kind ? null : kind;
    let result;
    try {
      // The Worker reads the current row, so a stale kind cannot conflict, and it answers the totals.
      ({ result } = await apiWriteAsUser("/api/write/reactions", {
        method: "PUT",
        body: { resourceType, resourceId, gameVersion, kind: next },
      }));
    } catch {
      return;
    }
    if (result.kind) window.localStorage.setItem(key, result.kind);
    else window.localStorage.removeItem(key);
    const card = button.closest("[data-colorful-philosophers-card]");
    card?.querySelectorAll("[data-cp-reaction]").forEach((other) => {
      const count = other.querySelector("[data-cp-count]");
      const otherKind = other.dataset.cpKind;
      if (!count || !otherKind) return;
      if (result.counts) {
        count.textContent = String(Number(result.counts[otherKind]) || 0);
      } else {
        // Committed, but the totals could not be read: adjust the shown ones.
        let value = Number(count.textContent) || 0;
        if (previous === otherKind) value = Math.max(0, value - 1);
        if (result.kind === otherKind) value += 1;
        count.textContent = String(value);
      }
      other.setAttribute("aria-pressed", result.kind === otherKind ? "true" : "false");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main, { once: true });
  } else {
    main();
  }
})();
