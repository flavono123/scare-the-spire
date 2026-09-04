import Image from "@/components/ui/static-image";
import {
  PROFILE_CHARACTER_NICKNAME_IDS,
  PROFILE_NICKNAME_LOCALES,
  PROFILE_NICKNAME_MAX_CHARS,
  PROFILE_NICKNAME_POOL_MAX,
  nicknamePoolFieldName,
  serializeNicknameLines,
  type ProfileCharacterNicknamePools,
  type ProfileNicknameLocale,
} from "@/lib/profile-character-nicknames";
import { characterIconUrl } from "@/lib/user-profile";

const LOCALE_LABELS: Record<ProfileNicknameLocale, string> = {
  ko: "한글",
  en: "영어",
};

export function AdminProfileNicknames({
  pools,
  source,
  canEdit,
  saveResult,
  error,
  onSave,
  onReset,
}: {
  pools: ProfileCharacterNicknamePools;
  source: "stored" | "defaults";
  canEdit: boolean;
  saveResult?: "saved" | "error" | "invalid";
  error?: string;
  onSave: (formData: FormData) => Promise<void>;
  onReset: (formData: FormData) => Promise<void>;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-primary">프로필 랜덤 닉</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            서비스 익명 닉은 제외합니다. 프로필에서 캐릭터를 고를 때 쓰는 한글/영어 풀입니다.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {source === "stored" ? "저장본" : "코드 기본값"}
        </span>
      </div>

      {saveResult && (
        <div
          id="nicks-save-result"
          role={saveResult === "saved" ? "status" : "alert"}
          className={`mb-4 rounded-md border px-4 py-3 text-sm ${
            saveResult === "saved"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
        >
          {saveResult === "saved"
            ? "저장했습니다. 프로필 캐릭터 선택에 바로 반영됩니다."
            : saveResult === "invalid"
              ? "한 줄에 닉 하나, 1–20자, 캐릭터·언어당 1–50개가 필요합니다."
              : "저장하지 못했습니다. 다시 시도해 주세요."}
        </div>
      )}

      {error && (
        <p className="mb-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          조회 실패: {error}
        </p>
      )}

      {!canEdit && (
        <div className="mb-3 rounded-md border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-amber-100">
          <code>SUPABASE_SECRET_KEY</code>를 서버 환경에 설정하면 이 목록을 저장할 수 있습니다.
        </div>
      )}

      <form action={onSave} className="space-y-4">
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">캐릭터</th>
                {PROFILE_NICKNAME_LOCALES.map((locale) => (
                  <th key={locale} className="px-3 py-2">{LOCALE_LABELS[locale]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PROFILE_CHARACTER_NICKNAME_IDS.map((characterId) => (
                <tr key={characterId} className="border-t border-border/70 align-top">
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-2">
                      <Image
                        src={characterIconUrl(characterId)}
                        alt=""
                        width={20}
                        height={20}
                        className="h-5 w-5 object-contain"
                      />
                      <code className="text-xs text-foreground">{characterId}</code>
                    </span>
                  </td>
                  {PROFILE_NICKNAME_LOCALES.map((locale) => {
                    const fieldName = nicknamePoolFieldName(characterId, locale);
                    const nicknames = pools[characterId][locale];
                    return (
                      <td key={locale} className="px-3 py-3">
                        <label className="sr-only" htmlFor={fieldName}>
                          {characterId} {LOCALE_LABELS[locale]}
                        </label>
                        <textarea
                          id={fieldName}
                          name={fieldName}
                          defaultValue={serializeNicknameLines(nicknames)}
                          rows={Math.min(8, Math.max(3, nicknames.length + 1))}
                          spellCheck={false}
                          disabled={!canEdit}
                          className="w-full resize-y rounded-md border border-border bg-background/70 px-3 py-2 font-mono text-xs leading-relaxed text-foreground outline-none focus:border-primary/60 disabled:opacity-80"
                        />
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {nicknames.length}개 · 한 줄에 하나 · {PROFILE_NICKNAME_MAX_CHARS}자 · 최대 {PROFILE_NICKNAME_POOL_MAX}개
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              className="h-9 rounded-md border border-primary/30 bg-primary/10 px-3 text-sm font-semibold text-primary hover:bg-primary/20"
            >
              저장
            </button>
            <button
              type="submit"
              formAction={onReset}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm text-muted-foreground hover:text-foreground"
            >
              코드 기본값으로 되돌리기
            </button>
            <span className="text-[11px] text-muted-foreground">
              이미 저장된 사용자 닉은 바뀌지 않습니다.
            </span>
          </div>
        )}
      </form>
    </section>
  );
}
