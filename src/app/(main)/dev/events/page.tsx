import fs from "fs/promises";
import path from "path";
import Image from "next/image";
import { RichText } from "@/components/rich-text";

export const metadata = {
  title: "이벤트 — DEV",
  description: "개발 전용: 전체 이벤트 데이터 및 BBCode 렌더링 미리보기",
};

interface EventOption {
  id: string;
  title: string;
  description: string;
}

interface EventPage {
  id: string;
  description: string | null;
  options: EventOption[] | null;
}

interface GameEvent {
  id: string;
  name: string;
  type: string;
  act: string | null;
  description: string;
  options: EventOption[] | null;
  pages: EventPage[] | null;
  dialogue: Record<string, unknown> | null;
  epithet: string | null;
  image_url: string | null;
}

const ACT_CONFIG: Record<
  string,
  { label: string; color: string; border: string; bg: string }
> = {
  "Act 1 - Overgrowth": {
    label: "Overgrowth",
    color: "text-green-400",
    border: "border-green-500/40",
    bg: "bg-green-500/10",
  },
  Underdocks: {
    label: "Underdocks",
    color: "text-blue-400",
    border: "border-blue-500/40",
    bg: "bg-blue-500/10",
  },
  "Act 2 - Hive": {
    label: "Hive",
    color: "text-orange-400",
    border: "border-orange-500/40",
    bg: "bg-orange-500/10",
  },
  "Act 3 - Glory": {
    label: "Glory",
    color: "text-yellow-400",
    border: "border-yellow-500/40",
    bg: "bg-yellow-500/10",
  },
};

const UNKNOWN_ACT_CONFIG = {
  label: "Unknown",
  color: "text-zinc-400",
  border: "border-zinc-500/40",
  bg: "bg-zinc-500/10",
};

const DATA_DIR = path.join(process.cwd(), "data/spire-codex");
const EVENTS_IMG_DIR = path.join(process.cwd(), "public/images/spire-codex/events");

/** Map spire-codex static URLs to local public paths */
function toLocalImagePath(url: string): string {
  return url.replace("/static/images/misc/ancients/", "/images/spire-codex/ancients/");
}

/** Get event image path from extracted game assets (lowercase ID match) */
function getEventImagePath(eventId: string, imageFiles: Set<string>): string | null {
  const key = eventId.toLowerCase();
  if (imageFiles.has(key)) {
    return `/images/spire-codex/events/${key}.png`;
  }
  return null;
}

async function loadEvents(): Promise<GameEvent[]> {
  const raw = await fs.readFile(
    path.join(DATA_DIR, "eng/events.json"),
    "utf-8",
  );
  return JSON.parse(raw) as GameEvent[];
}

async function loadEventImageFiles(): Promise<Set<string>> {
  const files = await fs.readdir(EVENTS_IMG_DIR);
  return new Set(
    files.filter((f) => f.endsWith(".png")).map((f) => f.replace(".png", "")),
  );
}

function ActBadge({ act }: { act: string | null }) {
  const config = act ? (ACT_CONFIG[act] ?? UNKNOWN_ACT_CONFIG) : UNKNOWN_ACT_CONFIG;
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${config.color} ${config.border} ${config.bg}`}
    >
      {config.label}
    </span>
  );
}

function OptionCard({ option }: { option: EventOption }) {
  return (
    <div className="rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2">
      <div className="mb-1 text-xs font-semibold text-amber-400">
        {option.title}
      </div>
      {option.description && (
        <div className="text-xs leading-relaxed text-zinc-300">
          <RichText text={option.description} />
        </div>
      )}
    </div>
  );
}

function EventPageBlock({
  page,
  index,
}: {
  page: EventPage;
  index: number;
}) {
  return (
    <div className="rounded border border-zinc-700/50 bg-zinc-800/30 px-3 py-2">
      <div className="mb-1 text-[10px] font-medium text-zinc-500">
        Page {index + 1} — {page.id}
      </div>
      {page.description && (
        <div className="text-sm leading-relaxed text-zinc-300">
          <RichText text={page.description} />
        </div>
      )}
      {page.options && page.options.length > 0 && (
        <div className="mt-2 space-y-1">
          {page.options.map((opt) => (
            <OptionCard key={opt.id} option={opt} />
          ))}
        </div>
      )}
    </div>
  );
}

function EventCard({
  event,
  eventImagePath,
}: {
  event: GameEvent;
  eventImagePath: string | null;
}) {
  const isAncient = !!event.image_url;
  return (
    <div
      className={`overflow-hidden rounded-lg border ${
        isAncient
          ? "border-amber-500/50 bg-gradient-to-br from-amber-500/10 via-card/50 to-card/50 shadow-[0_0_12px_-3px_rgba(245,158,11,0.25)]"
          : "border-border bg-card/50"
      }`}
    >
      {/* Event illustration banner */}
      {eventImagePath && (
        <div className="relative h-[200px] w-full">
          <Image
            src={eventImagePath}
            alt={event.name}
            fill
            unoptimized
            className="object-cover"
          />
        </div>
      )}

      <div className="p-4">
        <div className="flex gap-4">
          {/* Main content */}
          <div className="min-w-0 flex-1">
            {/* Header */}
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-base font-semibold">
                {isAncient && (
                  <span className="mr-1.5 text-amber-400" title="Ancient Being">
                    ✦
                  </span>
                )}
                {event.name}
              </h3>
              <ActBadge act={event.act} />
              {event.epithet && (
                <span className="text-xs italic text-muted-foreground">
                  — {event.epithet}
                </span>
              )}
            </div>

            {/* Description */}
            {event.description && (
              <div className="mb-4 text-sm leading-[1.75] text-zinc-300">
                <RichText text={event.description} />
              </div>
            )}
          </div>

          {/* Ancient portrait */}
          {isAncient && event.image_url && (
            <div className="flex-shrink-0">
              <div className="overflow-hidden rounded-lg border border-amber-500/30 shadow-[0_0_8px_-2px_rgba(245,158,11,0.3)]">
                <Image
                  src={toLocalImagePath(event.image_url)}
                  alt={event.name}
                  width={88}
                  height={88}
                  unoptimized
                  className="object-cover"
                />
              </div>
            </div>
          )}
        </div>

        {/* Options */}
        {event.options && event.options.length > 0 && (
          <div className="mb-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Options
            </div>
            <div className="space-y-1.5">
              {event.options.map((opt) => (
                <OptionCard key={opt.id} option={opt} />
              ))}
            </div>
          </div>
        )}

        {/* Pages */}
        {event.pages && event.pages.length > 0 && (
          <details className="group">
            <summary className="mb-2 cursor-pointer text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300">
              Pages ({event.pages.length})
              <span className="ml-1 inline-block transition-transform group-open:rotate-90">
                ▶
              </span>
            </summary>
            <div className="space-y-2">
              {event.pages.map((page, i) => (
                <EventPageBlock key={page.id + i} page={page} index={i} />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function EventImageGallery({
  events,
  eventImageFiles,
}: {
  events: GameEvent[];
  eventImageFiles: Set<string>;
}) {
  // Build a map from lowercase event ID to event name for labeling
  const idToName = new Map<string, string>();
  for (const event of events) {
    idToName.set(event.id.toLowerCase(), event.name);
  }

  // Sort image files alphabetically
  const sortedFiles = Array.from(eventImageFiles).sort();

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-lg font-semibold text-zinc-200">
        이벤트 이미지 갤러리
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          ({sortedFiles.length})
        </span>
      </h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
        {sortedFiles.map((fileKey) => {
          const name = idToName.get(fileKey) ?? fileKey.replace(/_/g, " ");
          return (
            <div
              key={fileKey}
              className="overflow-hidden rounded-lg border border-border bg-card/50"
            >
              <div className="relative h-[100px] w-full">
                <Image
                  src={`/images/spire-codex/events/${fileKey}.png`}
                  alt={name}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
              <div className="px-2 py-1.5">
                <div className="truncate text-xs text-zinc-300">{name}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default async function EventsDevPage() {
  const [events, eventImageFiles] = await Promise.all([
    loadEvents(),
    loadEventImageFiles(),
  ]);

  // Group by act
  const groups: Record<string, GameEvent[]> = {};
  for (const event of events) {
    const key = event.act ?? "__none__";
    if (!groups[key]) groups[key] = [];
    groups[key].push(event);
  }

  // Sort order for acts
  const actOrder = [
    "Act 1 - Overgrowth",
    "Underdocks",
    "Act 2 - Hive",
    "Act 3 - Glory",
    "__none__",
  ];
  const sortedKeys = actOrder.filter((k) => groups[k]);

  // Stats
  const totalEvents = events.length;
  const statEntries = sortedKeys.map((key) => ({
    label:
      key === "__none__"
        ? "Act 미지정"
        : (ACT_CONFIG[key]?.label ?? key),
    count: groups[key].length,
    config: key === "__none__" ? UNKNOWN_ACT_CONFIG : (ACT_CONFIG[key] ?? UNKNOWN_ACT_CONFIG),
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* DEV banner */}
      <div className="mb-6 rounded border border-yellow-500/30 bg-yellow-500/5 px-4 py-2">
        <span className="text-xs font-bold text-yellow-500">DEV ONLY</span>
        <span className="ml-2 text-xs text-muted-foreground">
          개발 환경 전용 레퍼런스 — 프로덕션 빌드에서 숨김 처리 필요
        </span>
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold">이벤트</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        DEV — 전체 이벤트 데이터 및 BBCode 렌더링 미리보기
      </p>

      {/* Stats */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="rounded border border-border bg-card/50 px-3 py-2 text-center">
          <div className="text-xl font-bold">{totalEvents}</div>
          <div className="text-[10px] text-muted-foreground">전체 이벤트</div>
        </div>
        {statEntries.map((s) => (
          <div
            key={s.label}
            className={`rounded border ${s.config.border} ${s.config.bg} px-3 py-2 text-center`}
          >
            <div className={`text-xl font-bold ${s.config.color}`}>
              {s.count}
            </div>
            <div className="text-[10px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Event image gallery */}
      <EventImageGallery events={events} eventImageFiles={eventImageFiles} />

      {/* Events grouped by act */}
      {sortedKeys.map((actKey) => {
        const actEvents = groups[actKey];
        const config =
          actKey === "__none__"
            ? UNKNOWN_ACT_CONFIG
            : (ACT_CONFIG[actKey] ?? UNKNOWN_ACT_CONFIG);
        const label =
          actKey === "__none__"
            ? "Act 미지정"
            : (ACT_CONFIG[actKey]?.label ?? actKey);

        return (
          <section key={actKey} className="mt-10">
            <h2
              className={`mb-4 flex items-center gap-2 text-lg font-semibold ${config.color}`}
            >
              {label}
              <span className="text-sm font-normal text-muted-foreground">
                ({actEvents.length})
              </span>
            </h2>
            <div className="space-y-4">
              {actEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  eventImagePath={getEventImagePath(event.id, eventImageFiles)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* Bottom spacer */}
      <div className="h-16" />
    </div>
  );
}
