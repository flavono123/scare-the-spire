import type { ContactCategory } from "@/lib/contact-inquiries";
import type { ServiceLocale } from "@/lib/i18n";

interface ContactCategoryMessage {
  label: string;
}

export interface ContactMessages {
  navLabel: string;
  metadata: {
    title: string;
    description: string;
  };
  eyebrow: string;
  privateNote: string;
  messageLabel: string;
  emailLabel: string;
  partnershipEmailHint: string;
  privacyNote: string;
  sourceNote: string;
  rateLimited: string;
  unavailableTitle: string;
  successDetail: string;
  sendAnother: string;
  categories: Record<ContactCategory, ContactCategoryMessage>;
}

export const contactMessages = {
  ko: {
    navLabel: "문의하기",
    metadata: {
      title: "문의하기 · 작은 우편함",
      description: "오류 제보, 정보 수정, 아이디어, 게시물 신고, 협업 제안을 운영자에게 비공개로 보냅니다.",
    },
    eyebrow: "1:1 문의",
    privateNote: "이곳에 보낸 내용은 사이트에 공개되지 않습니다.",
    messageLabel: "문의 내용",
    emailLabel: "답변받을 이메일",
    partnershipEmailHint: "협업·제휴 문의에는 답변받을 이메일이 필요합니다.",
    privacyNote: "이메일은 문의 답변에만 사용하며 사이트에 공개하지 않습니다.",
    sourceNote: "문의가 시작된 페이지 경로와 화면 크기도 함께 전달됩니다.",
    rateLimited: "한 시간에 문의를 3번까지 보낼 수 있습니다. 잠시 뒤 다시 시도해 주세요.",
    unavailableTitle: "지금은 우편함을 이용할 수 없습니다",
    successDetail: "운영자만 볼 수 있는 우편함에 도착했습니다.",
    sendAnother: "다른 문의 보내기",
    categories: {
      bug: { label: "오류·버그" },
      correction: { label: "정보·번역 수정" },
      feedback: { label: "의견·아이디어" },
      report: { label: "게시물 신고" },
      partnership: { label: "협업·제휴" },
      other: { label: "기타 문의" },
    },
  },
  en: {
    navLabel: "Contact",
    metadata: {
      title: "Contact · Tiny Mailbox",
      description: "Privately send bug reports, corrections, ideas, content reports, and partnership proposals to the operator.",
    },
    eyebrow: "1:1 contact",
    privateNote: "Messages sent here are never published on the site.",
    messageLabel: "Message",
    emailLabel: "Reply email",
    partnershipEmailHint: "A reply email is required for partnership inquiries.",
    privacyNote: "Your email is used only to reply and is never shown on the site.",
    sourceNote: "The source page path and viewport size are included automatically.",
    rateLimited: "You can send up to three inquiries per hour. Please try again later.",
    unavailableTitle: "The mailbox is unavailable right now",
    successDetail: "Your message arrived in the operator-only mailbox.",
    sendAnother: "Send another message",
    categories: {
      bug: { label: "Bug" },
      correction: { label: "Info correction" },
      feedback: { label: "Feedback & ideas" },
      report: { label: "Content report" },
      partnership: { label: "Partnership" },
      other: { label: "Other" },
    },
  },
} as const satisfies Record<ServiceLocale, ContactMessages>;
