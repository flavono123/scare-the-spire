"use client";

import Image from "@/components/ui/static-image";
import { courierSourceCatalog } from "@/components/comment-courier";

export function CourierTokensDevPage() {
  const sources = courierSourceCatalog("ko");
  return (
    <div className="mx-auto max-w-3xl space-y-3 px-4 py-6">
      <h1 className="font-service text-xl font-bold text-primary">배달원 토큰</h1>
      <p className="text-sm text-zinc-400">
        슬서운변경과 백과사전은 댓글을 같은 스레드에 저장해서, 줄에는 카드·유물 같은 종류 토큰만 나옵니다.
      </p>
      <ul className="space-y-2">
        {sources.map((source) => (
          <li key={source.id} className="flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-2 py-1 text-xs text-zinc-300">
            <Image src={source.token} alt={source.label} width={16} height={16} className="h-4 w-4 object-contain" />
            <span className="truncate">댓글이 길어지면 말줄임으로 잘립니다</span>
            <span className="ml-auto shrink-0 text-[10px] text-zinc-500">{source.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
