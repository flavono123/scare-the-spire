(() => {
  const CONFIG_ID = "sts-patch-comments-config";
  const PROFILE_KEY = "sts-user-profile";
  const QUERY_TIMEOUT_MS = 8000;
  const AUTH_TIMEOUT_MS = 8000;
  const CHARACTER_ICON_SLUGS = {
    IRONCLAD: "ironclad",
    SILENT: "silent",
    REGENT: "regent",
    NECROBINDER: "necrobinder",
    DEFECT: "defect",
  };

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

  function characterIconUrl(characterId) {
    const slug = CHARACTER_ICON_SLUGS[characterId] ?? CHARACTER_ICON_SLUGS.NECROBINDER;
    return `/images/sts2/characters/character_icon_${slug}.webp`;
  }

  function readStoredCharacterIconUrl() {
    try {
      const raw = window.localStorage.getItem(PROFILE_KEY);
      const characterId = raw ? JSON.parse(raw)?.characterId : null;
      return characterIconUrl(typeof characterId === "string" ? characterId : "NECROBINDER");
    } catch {
      return characterIconUrl("NECROBINDER");
    }
  }

  function syncProfileCharacterIcon() {
    const iconUrl = readStoredCharacterIconUrl();
    document.querySelectorAll("[data-profile-character-icon]").forEach((image) => {
      if (image instanceof HTMLImageElement && image.getAttribute("src") !== iconUrl) {
        image.src = iconUrl;
      }
    });
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

  function openStoryComposer(action, config) {
    const text = copy();
    const patchLineId = action.dataset.patchLineId;
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
          <textarea data-static-story-sentence maxlength="120" rows="3" required minlength="2" placeholder="${escapeHtml(text.storyPlaceholder)}" class="min-h-24 w-full resize-none rounded-md border border-border/70 bg-background/60 px-3 py-2 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-yellow-500/40"></textarea>
          <div class="flex items-center gap-2">
            <input data-static-story-nickname type="text" maxlength="20" required value="${escapeHtml(readStoredNickname(text.defaultNickname))}" placeholder="${escapeHtml(text.storyNickname)}" class="h-8 min-w-0 flex-1 rounded-md border border-border/60 bg-background/50 px-2.5 text-xs text-muted-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-yellow-500/40" />
            <span data-static-story-count class="shrink-0 text-[11px] tabular-nums text-muted-foreground">0/120</span>
          </div>
          <div class="rounded-md border border-yellow-500/20 bg-yellow-500/[0.035] px-3 py-2.5">
            <span class="block text-[11px] font-medium text-yellow-500">${escapeHtml(patchId)}</span>
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
    const text = copy();
    const commentsHtml = state.comments.length === 0
      ? `<p class="text-xs text-muted-foreground">${escapeHtml(text.empty)}</p>`
      : `
        <ul class="space-y-3">
          ${state.comments.map((comment) => {
            const likeCount = state.likeCounts.get(comment.id) ?? 0;
            const liked = state.liked.has(comment.id);
            const canDelete = state.userId && state.userId === comment.user_id;
            return `
              <li class="rounded-lg border border-border/50 bg-card/20 px-3 py-2.5 text-sm">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-yellow-500">${escapeHtml(comment.nickname)}</span>
                  <span class="text-[10px] text-muted-foreground">${new Date(comment.created_at).toLocaleDateString(serviceLocale() === "ko" ? "ko-KR" : "en-US")}</span>
                  <button data-comment-like="${escapeHtml(comment.id)}" class="flex items-center gap-0.5 text-[10px] text-muted-foreground transition-all">
                    <img src="/images/relics/runic-dodecahedron.webp" alt="${escapeHtml(text.likeAlt)}" width="14" height="14" class="transition-all ${liked ? "" : "opacity-40 grayscale"}" />
                    ${likeCount > 0 ? `<span>${likeCount}</span>` : ""}
                  </button>
                  ${canDelete ? `<button data-comment-delete="${escapeHtml(comment.id)}" class="text-[10px] text-muted-foreground hover:text-red-400">${escapeHtml(text.delete)}</button>` : ""}
                </div>
                <div class="mt-1.5 text-muted-foreground leading-relaxed break-words">${renderText(commentContent(comment))}</div>
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
          class="w-full rounded bg-zinc-800 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-yellow-500/50"
        />
        <textarea
          data-comment-content
          placeholder="${escapeHtml(text.placeholder)}"
          rows="3"
          class="w-full resize-y rounded bg-zinc-800 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-yellow-500/50"
        ></textarea>
        <button
          type="submit"
          class="rounded bg-yellow-500 px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-yellow-400 disabled:opacity-60"
        >
          ${escapeHtml(state.submitting ? "..." : text.submit)}
        </button>
      </form>
    `;
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
    };

    root.addEventListener("submit", async (event) => {
      const form = event.target.closest("[data-comment-form]");
      if (!form) return;

      event.preventDefault();
      const contentInput = form.querySelector("[data-comment-content]");
      const nicknameInput = form.querySelector("[data-comment-nickname]");
      const content = contentInput?.value.trim() ?? "";
      const nickname = (nicknameInput?.value.trim() || copy().defaultNickname).slice(0, 20);
      if (!content || state?.submitting) return;

      state.submitting = true;
      renderComments(root, state);

      try {
        const session = await ensureSession(config);
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
    syncProfileCharacterIcon();
    window.addEventListener("storage", (event) => {
      if (event.key === null || event.key === PROFILE_KEY) syncProfileCharacterIcon();
    });

    const config = readConfig();
    mountStoryActions(config);

    const roots = Array.from(document.querySelectorAll("[data-patch-comment-root]"))
      .filter((root) => !("richCommentMounted" in root.dataset));
    if (roots.length === 0) return;

    if (!config) {
      roots.forEach(renderUnavailable);
      return;
    }

    roots.forEach((root) => {
      mountRoot(root, config);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main, { once: true });
  } else {
    main();
  }
})();
