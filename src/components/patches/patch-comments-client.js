(() => {
  const CONFIG_ID = "sts-patch-comments-config";
  const PROFILE_KEY = "sts-user-profile";
  const QUERY_TIMEOUT_MS = 8000;
  const AUTH_TIMEOUT_MS = 8000;

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

  function isMissingCommentLikes(error) {
    return error?.status === 404 && String(error.body ?? "").includes("comment_likes");
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
      <div class="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
        ${escapeHtml(copy().unavailableTitle)}
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
      try {
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
      } catch (error) {
        if (!isMissingCommentLikes(error)) throw error;
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
          try {
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
          } catch (error) {
            if (!isMissingCommentLikes(error)) throw error;
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
    const roots = Array.from(document.querySelectorAll("[data-patch-comment-root]"));
    if (roots.length === 0) return;

    const config = readConfig();
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
