import type { Metadata } from "next";
import {
  getCodexCharacters,
  getCodexEncounters,
  getCodexMonsters,
} from "@/lib/codex-data";
import { CHARACTER_ORDER, type CodexCharacter } from "@/lib/codex-types";
import { buildPaletteSubjects, subjectsForKind } from "@/lib/dev-palette-subjects";
import { getEncounterMonsterIds } from "@/lib/encounter-compositions";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { serviceMessages } from "@/messages/service";
import ProfilePage, {
  type BossChoice,
  type CharacterChoice,
} from "./profile-page";

export async function generateProfileMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = serviceMessages[serviceLocale].profile;

  return {
    title: copy.metadata.title,
    description: copy.metadata.description,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export async function renderProfilePage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = serviceMessages[serviceLocale].profile;

  const [characters, monsters, encounters] = await Promise.all([
    getCodexCharacters({ gameLocale }),
    getCodexMonsters({ gameLocale }),
    getCodexEncounters({ gameLocale }),
  ]);

  const bossEncounters = encounters.filter((encounter) => encounter.roomType === "Boss");
  const encounterById = new Map(bossEncounters.map((encounter) => [encounter.id, encounter]));
  const bossMonsterIds = new Set(bossEncounters.flatMap(getEncounterMonsterIds));
  const bossSubjects = subjectsForKind(
    buildPaletteSubjects({
      characters: [],
      monsters,
      ancients: [],
      encounters: bossEncounters,
    }),
    "boss",
  );

  return (
    <ProfilePage
      key={serviceLocale}
      characters={orderCharacters(characters).map(mapCharacter)}
      bosses={bossSubjects.flatMap((subject) => {
        const encounter = encounterById.get(subject.id);
        if (!encounter) return [];
        const choice: BossChoice = {
          id: subject.id,
          label: subject.name,
          iconUrl: subject.tokenUrl ?? subject.pickerImageUrl ?? "",
          encounter,
          spinePreview: subject.spinePreview === "static" ? "static" : "encounter",
          staticPreviewUrl: subject.staticPreviewUrl,
        };
        return [choice];
      })}
      bossMonsters={monsters.filter((monster) => bossMonsterIds.has(monster.id))}
      copy={copy}
      nicknameLocale={serviceLocale}
      gameLocale={gameLocale}
    />
  );
}

function mapCharacter(character: CodexCharacter): CharacterChoice {
  return {
    id: character.id,
    label: character.name,
    iconUrl: character.iconUrl,
    fallbackImageUrl: character.combatImageUrl,
    spineAsset: character.spineAsset,
  };
}

function orderCharacters(characters: CodexCharacter[]): CodexCharacter[] {
  const order: ReadonlyMap<string, number> = new Map(CHARACTER_ORDER.map((id, index) => [id, index]));
  return [...characters].sort((a, b) => {
    const orderA = order.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const orderB = order.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB || a.name.localeCompare(b.name, "ko");
  }  );
}
