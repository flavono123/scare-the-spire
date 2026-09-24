"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { hasUnseenContactReply } from "@/lib/contact-inquiries";
import { supabaseEnv } from "@/lib/supabase";

const MAILBOX_REPLY_EVENT = "sts-mailbox-reply";
const CACHE_MS = 60_000;

type MailboxReplyDetail = { unseen: boolean };

function cacheKey(userId: string): string {
  return `sts-mailbox-reply:${supabaseEnv}:${userId}`;
}

function readCache(userId: string): boolean | null {
  try {
    const raw = window.sessionStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; unseen?: boolean };
    if (typeof parsed.at !== "number" || Date.now() - parsed.at > CACHE_MS) return null;
    return parsed.unseen === true;
  } catch {
    return null;
  }
}

export function publishMailboxReply(userId: string, unseen: boolean): void {
  try {
    window.sessionStorage.setItem(cacheKey(userId), JSON.stringify({ at: Date.now(), unseen }));
  } catch {
    // Private browsing can reject sessionStorage writes.
  }
  window.dispatchEvent(new CustomEvent<MailboxReplyDetail>(MAILBOX_REPLY_EVENT, { detail: { unseen } }));
}

export function useMailboxReply(): boolean {
  const { userId, ready } = useAuth();
  const [unseen, setUnseen] = useState(false);

  useEffect(() => {
    if (!ready || !userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no signed-in mailbox to check
      setUnseen(false);
      return;
    }

    const cached = readCache(userId);
    if (cached !== null) setUnseen(cached);

    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<MailboxReplyDetail>).detail;
      if (detail) setUnseen(detail.unseen === true);
    };
    window.addEventListener(MAILBOX_REPLY_EVENT, onUpdate);

    if (cached === null) {
      void hasUnseenContactReply().then((next) => {
        if (next === null) return;
        publishMailboxReply(userId, next);
      });
    }

    return () => window.removeEventListener(MAILBOX_REPLY_EVENT, onUpdate);
  }, [ready, userId]);

  return unseen;
}
