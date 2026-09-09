"use client";

import { RichText } from "@/components/rich-text";
import {
  restSiteChoiceDescription,
  restSiteChoiceIconSrc,
  restSiteChoiceLabel,
  restSiteOptionsForEntry,
} from "@/lib/history-party";
import type { GameLocale } from "@/lib/i18n";
import type { ReplayHistoryEntry } from "@/lib/sts2-run-replay";
import { cn } from "@/lib/utils";

const OUTLINE = "/images/sts2/ui/rest-site/option_outline.webp";

/**
 * Rest-site choice row from `scenes/rooms/rest_site_room.tscn`:
 * header + HBox of 250×163 icon buttons + hovered/picked description.
 */
export function RestSiteScreen({
  entry,
  gameLocale,
  revealed,
  prompt,
}: {
  entry: ReplayHistoryEntry;
  gameLocale: GameLocale;
  revealed: boolean;
  prompt: string;
}) {
  const options = restSiteOptionsForEntry(entry);
  const picked = new Set(
    (entry.rest_site_choices ?? []).map((choice) => choice.toUpperCase().replace(/^OPTION_/, "")),
  );
  const focused = options.find((id) => picked.has(id)) ?? options[0];
  const description = focused ? restSiteChoiceDescription(focused, gameLocale, entry) : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10" data-history-rest-site>
      <div
        className="absolute left-1/2 top-[14%] w-[min(52rem,80%)] -translate-x-1/2 text-center font-game-title text-[22px] leading-tight text-[#fff6e2] sm:text-[28px]"
        style={{ textShadow: "0 0 0 rgba(0,0,0,0.25)", WebkitTextStroke: "0.6px rgba(0,0,0,0.25)" }}
      >
        {prompt}
      </div>
      <div className="absolute left-1/2 top-[24%] flex -translate-x-1/2 items-start justify-center gap-[5.2%]">
        {options.map((option) => {
          const isPicked = picked.has(option);
          return (
            <RestSiteOptionButton
              key={option}
              option={option}
              label={restSiteChoiceLabel(option, gameLocale)}
              picked={isPicked}
              revealed={revealed}
            />
          );
        })}
      </div>
      {description ? (
        <div
          className="absolute left-1/2 top-[52%] w-[min(42rem,72%)] -translate-x-1/2 text-center font-game-text text-[16px] leading-[1.35] text-[#fff6e2] sm:text-[20px]"
          style={{ textShadow: "3px 2px 0 rgba(0,0,0,0.5)" }}
        >
          <RichText text={description} />
        </div>
      ) : null}
    </div>
  );
}

function RestSiteOptionButton({
  option,
  label,
  picked,
  revealed,
}: {
  option: string;
  label: string;
  picked: boolean;
  revealed: boolean;
}) {
  const icon = restSiteChoiceIconSrc(option);
  return (
    <div
      data-history-last-scene-pick={option}
      data-picked={picked ? "true" : "false"}
      className={cn(
        "flex w-[13vw] max-w-[250px] min-w-[7.5rem] flex-col items-center transition-all duration-300",
        revealed && !picked && "opacity-40",
        revealed && picked && "scale-105",
      )}
    >
      <div className="relative aspect-[250/163] w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon} alt="" className="absolute inset-0 h-full w-full object-contain" />
        <div
          className={cn(
            "absolute inset-0 mix-blend-screen transition-opacity duration-300",
            revealed && picked ? "opacity-100" : "opacity-0",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={OUTLINE}
            alt=""
            className="h-full w-full object-contain"
            style={{ filter: "drop-shadow(0 0 8px rgba(255,179,0,0.55))" }}
          />
        </div>
      </div>
      <div
        className="mt-1 text-center font-game-title text-[16px] text-[#d4b65b] sm:text-[20px]"
        style={{ WebkitTextStroke: "0.45px rgba(0,0,0,0.5)" }}
      >
        {label}
      </div>
    </div>
  );
}
