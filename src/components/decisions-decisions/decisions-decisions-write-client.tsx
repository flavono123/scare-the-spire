"use client";

import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import {
  DecisionsDecisionsComposer,
  type DecisionsDecisionsComposerValues,
} from "@/components/decisions-decisions/decisions-decisions-composer";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import Image from "@/components/ui/static-image";
import { useAuth } from "@/hooks/use-auth";
import { useDecisionsDecisionsCatalog } from "@/hooks/use-decisions-decisions-catalog";
import {
  insertDecisionsDecisionsPost,
  useDecisionsDecisionsPost,
} from "@/hooks/use-decisions-decisions-posts";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { useUserProfile } from "@/hooks/use-user-profile";
import type { DecisionsDecisionsGameCopy } from "@/lib/borrowed-game-copy";
import {
  DECISIONS_DECISIONS_HREF,
  DECISIONS_DECISIONS_TOKEN_SRC,
} from "@/lib/decisions-decisions";
import { localizeHrefWithGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_USER_PROFILE } from "@/lib/user-profile";
import { serviceMessages } from "@/messages/service";

type Catalog = ReturnType<typeof useDecisionsDecisionsCatalog>;
type Submit = (values: DecisionsDecisionsComposerValues) => Promise<boolean>;

const noSubscribe = () => () => {};

/** `?edit=<post id>` after hydration; the page itself is one static shell. */
function readEditId(): string | null {
  const id = new URLSearchParams(window.location.search).get("edit");
  return id && /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : null;
}

function EditComposer({
  postId,
  catalog,
  gameLocale,
  gameCopy,
  profileNickname,
  onSaved,
}: {
  postId: string;
  catalog: Catalog;
  gameLocale: GameLocale;
  gameCopy: DecisionsDecisionsGameCopy;
  profileNickname: string;
  onSaved: (id: string) => void;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].decisionsDecisions;
  const { userId, ready, ensureUser } = useAuth();
  const { post, loading, unavailable, update, setUnavailable } = useDecisionsDecisionsPost(postId, userId);

  const handleSubmit = useCallback<Submit>(async (values) => {
    const activeUserId = userId ?? await ensureUser();
    if (!activeUserId) return false;
    try {
      const next = await update({ ...values, activeUserId });
      if (next) onSaved(next.id);
      return Boolean(next);
    } catch {
      setUnavailable(true);
      return false;
    }
  }, [ensureUser, onSaved, setUnavailable, update, userId]);

  if (unavailable) return <StorageUnavailableNotice title={copy.unavailableTitle} />;
  if (loading || !ready) return <ContentLoadingNotice label={copy.loading} />;
  if (!post) return <p className="text-sm text-muted-foreground">{copy.notFound}</p>;
  if (post.user_id !== userId) {
    return <p className="text-sm text-muted-foreground">{copy.editNotAllowed}</p>;
  }
  return (
    <DecisionsDecisionsComposer
      key={post.id}
      entities={catalog.entities}
      entityMap={catalog.entityMap}
      stamps={catalog.stamps}
      gameLocale={gameLocale}
      serviceLocale={serviceLocale}
      presetLabels={gameCopy.presetLabels}
      submitLabel={copy.saveChanges}
      profileNickname={profileNickname}
      initial={post}
      onSubmit={handleSubmit}
      embedded
    />
  );
}

export function DecisionsDecisionsWriteClient({
  gameLocale,
  gameCopy,
}: {
  gameLocale: GameLocale;
  gameCopy: DecisionsDecisionsGameCopy;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].decisionsDecisions;
  const router = useRouter();
  const { userId, ready, ensureUser } = useAuth();
  const catalog = useDecisionsDecisionsCatalog(gameLocale, { includeLegacy: true });
  const profileFallback = useMemo(
    () => ({ ...DEFAULT_USER_PROFILE, nickname: copy.defaultNickname }),
    [copy.defaultNickname],
  );
  const { profile } = useUserProfile(profileFallback);
  // undefined on the server render, before the query string can be read.
  const editId = useSyncExternalStore<string | null | undefined>(noSubscribe, readEditId, () => undefined);
  const [unavailable, setUnavailable] = useState(false);

  const localize = useCallback(
    (href: string) => localizeHrefWithGameLocale(href, serviceLocale, gameLocale),
    [gameLocale, serviceLocale],
  );
  const indexHref = localize(DECISIONS_DECISIONS_HREF);
  const openPost = useCallback((id: string) => {
    router.push(localize(`${DECISIONS_DECISIONS_HREF}/${id}`));
  }, [localize, router]);

  const handleCreate = useCallback<Submit>(async (values) => {
    const activeUserId = userId ?? await ensureUser();
    if (!activeUserId) return false;
    try {
      const post = await insertDecisionsDecisionsPost({ ...values, activeUserId });
      if (post) openPost(post.id);
      return Boolean(post);
    } catch {
      setUnavailable(true);
      return false;
    }
  }, [ensureUser, openPost, userId]);

  let body: ReactNode;
  if (unavailable) {
    body = <StorageUnavailableNotice title={copy.unavailableTitle} />;
  } else if (editId === undefined || !ready || catalog.loading) {
    body = <ContentLoadingNotice label={copy.loading} />;
  } else if (catalog.error) {
    body = <p className="text-sm text-muted-foreground">{copy.resourcesMissing}</p>;
  } else if (editId) {
    body = (
      <EditComposer
        postId={editId}
        catalog={catalog}
        gameLocale={gameLocale}
        gameCopy={gameCopy}
        profileNickname={profile.nickname}
        onSaved={openPost}
      />
    );
  } else {
    body = (
      <DecisionsDecisionsComposer
        entities={catalog.entities}
        entityMap={catalog.entityMap}
        stamps={catalog.stamps}
        gameLocale={gameLocale}
        serviceLocale={serviceLocale}
        presetLabels={gameCopy.presetLabels}
        submitLabel={copy.submit}
        profileNickname={profile.nickname}
        onSubmit={handleCreate}
        embedded
      />
    );
  }

  return (
    <div className="space-y-4" data-decisions-decisions-write>
      <Link
        href={indexHref}
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <ArrowLeft size={14} />
        {copy.backToIndex}
      </Link>
      <header className="flex items-center gap-3">
        <Image
          src={DECISIONS_DECISIONS_TOKEN_SRC}
          alt=""
          width={32}
          height={32}
          className="object-contain"
        />
        <h1 className="font-service text-xl font-bold spire-gold">
          {editId ? copy.writeEditTitle : copy.writeCreateTitle}
        </h1>
      </header>
      {body}
    </div>
  );
}
