import "server-only";

import { revalidatePath } from "next/cache";
import type {
  ContactCategory,
  ContactInquiryEnv,
  ContactInquiryStatus,
} from "@/lib/contact-inquiries";
import { devToolsEnabled } from "@/lib/dev-tools";
import { contactMessages } from "@/messages/contact";
import { adminDeps } from "../../../scripts/admin/admin-deps";
import { readAdminContactInquiries } from "../../../scripts/admin/admin-reads";
import { replyToContactInquiry } from "../../../scripts/admin/admin-writes";

const CONTACT_ENV_LABELS: Record<ContactInquiryEnv, string> = {
  production: "운영",
  development: "개발",
};

const CONTACT_STATUS_LABELS: Record<ContactInquiryStatus, string> = {
  new: "접수",
  reviewing: "확인 중",
  done: "답변 완료",
  spam: "스팸",
};

const CONTACT_STATUSES = Object.keys(CONTACT_STATUS_LABELS) as ContactInquiryStatus[];

interface ContactInquiryAdminRow {
  id: string;
  user_id: string | null;
  category: ContactCategory;
  message: string;
  reply_email: string | null;
  page_path: string;
  service_locale: string;
  game_locale: string;
  env: ContactInquiryEnv;
  status: ContactInquiryStatus;
  admin_response: string | null;
  responded_at: string | null;
  created_at: string;
}


async function readContactInquiries(): Promise<{ data: ContactInquiryAdminRow[]; count?: number; error?: string } | null> {
  // From the store the reply writes to (source.contact of each env), so a reply shows at once.
  const result = await readAdminContactInquiries(adminDeps());
  if (!result) return null;
  return { data: result.data as unknown as ContactInquiryAdminRow[], count: result.count, error: result.error };
}

async function respondToContactInquiry(formData: FormData) {
  "use server";

  try {
    if (!devToolsEnabled()) throw new Error("Dev tools are disabled");

    // The same checks as before (checkInquiryReply), then Supabase or D1 by source.contact of the
    // inquiry's env (each env's rows live in its own D1).
    await replyToContactInquiry(adminDeps(), {
      id: String(formData.get("id") ?? ""),
      dataEnv: String(formData.get("env") ?? ""),
      response: String(formData.get("response") ?? ""),
      status: String(formData.get("status") ?? "") as ContactInquiryStatus,
    });

    revalidatePath("/contact");
  } catch (error) {
    console.error("Failed to save contact inquiry response", error);
  }

}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

export async function ContactInboxPanel() {
  const contactInquiries = await readContactInquiries();
  const contactRows = contactInquiries?.data ?? [];
  return (
    <div className="space-y-2">
      {contactInquiries?.error && <p className="text-xs text-red-300">{contactInquiries.error}</p>}
      <p className="text-xs text-muted-foreground">
        {contactInquiries
          ? `전체 ${(contactInquiries.count ?? contactRows.length).toLocaleString("ko-KR")}개 · 최근 ${contactRows.length.toLocaleString("ko-KR")}개 표시`
          : "서버 키 설정 필요"}
      </p>
        {!contactInquiries ? (
          <div className="rounded-md border border-amber-500/25 bg-amber-500/5 px-4 py-4 text-sm text-amber-100">
            <code>SUPABASE_SECRET_KEY</code>를 서버 환경에 설정하면 문의를 조회하고 답변할 수 있습니다.
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-2">
            {(["production", "development"] as const).map((env) => {
              const rows = contactRows.filter((inquiry) => inquiry.env === env);
              return (
                <div key={env}>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <span className={env === "production" ? "text-emerald-300" : "text-sky-300"}>
                      {CONTACT_ENV_LABELS[env]}
                    </span>
                    <code className="text-[10px] text-muted-foreground">{env}</code>
                    <span className="text-xs font-normal text-muted-foreground">{rows.length}개</span>
                  </h3>
                  <div className="space-y-3">
                    {rows.map((inquiry) => (
                      <article key={inquiry.id} className="rounded-md border border-border bg-card/35 p-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <strong className="text-primary">
                            {contactMessages.ko.categories[inquiry.category].label}
                          </strong>
                          <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                            {CONTACT_STATUS_LABELS[inquiry.status]}
                          </span>
                          <time className="ml-auto text-muted-foreground" dateTime={inquiry.created_at}>
                            {formatDate(inquiry.created_at)}
                          </time>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                          {inquiry.message}
                        </p>
                        <dl className="mt-3 grid gap-x-4 gap-y-1 border-t border-border/70 pt-3 text-[11px] text-muted-foreground sm:grid-cols-2">
                          <div><dt className="inline font-semibold">답변 이메일 </dt><dd className="inline">{inquiry.reply_email ?? "-"}</dd></div>
                          <div><dt className="inline font-semibold">문의 위치 </dt><dd className="inline"><code>{inquiry.page_path}</code></dd></div>
                          <div><dt className="inline font-semibold">언어 </dt><dd className="inline">{inquiry.service_locale} / {inquiry.game_locale}</dd></div>
                          <div><dt className="inline font-semibold">user_id </dt><dd className="inline"><code>{inquiry.user_id ?? "-"}</code></dd></div>
                        </dl>
                        <form action={respondToContactInquiry} className="mt-4 space-y-2">
                          <input type="hidden" name="id" value={inquiry.id} />
                          <input type="hidden" name="env" value={inquiry.env} />
                          <label className="block text-xs font-semibold text-muted-foreground" htmlFor={`response-${inquiry.id}`}>
                            운영자 답변
                          </label>
                          <textarea
                            id={`response-${inquiry.id}`}
                            name="response"
                            defaultValue={inquiry.admin_response ?? ""}
                            maxLength={8000}
                            rows={4}
                            className="w-full resize-y rounded-md border border-border bg-background/70 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              name="status"
                              defaultValue={inquiry.status}
                              aria-label="문의 상태"
                              className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                            >
                              {CONTACT_STATUSES.map((status) => (
                                <option key={status} value={status}>{CONTACT_STATUS_LABELS[status]}</option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              className="h-9 rounded-md border border-primary/30 bg-primary/10 px-3 text-sm font-semibold text-primary hover:bg-primary/20"
                            >
                              저장
                            </button>
                            <span className="text-[11px] text-muted-foreground">
                              {inquiry.admin_response
                                ? "저장하면 기존 답변을 덮어씁니다."
                                : "답변을 입력하면 답변 완료로 저장됩니다."}
                            </span>
                          </div>
                        </form>
                      </article>
                    ))}
                    {rows.length === 0 && (
                      <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                        문의 없음
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
