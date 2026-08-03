import type { ContactCategory } from "@/lib/contact-inquiries";
import type { ServiceLocale } from "@/lib/i18n";

interface ContactCategoryMessage {
  label: string;
  description: string;
}

export interface ContactMessages {
  navLabel: string;
  metadata: {
    title: string;
    description: string;
  };
  eyebrow: string;
  description: string;
  privateNote: string;
  messageLabel: string;
  messageHint: string;
  emailLabel: string;
  emailHint: string;
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
    eyebrow: "비공개 문의",
    description: "오류 제보부터 아이디어와 협업 제안까지, 운영자에게 전할 이야기를 넣어주세요.",
    privateNote: "이곳에 보낸 내용은 사이트에 공개되지 않습니다.",
    messageLabel: "문의 내용",
    messageHint: "확인할 수 있도록 10자 이상 구체적으로 적어주세요.",
    emailLabel: "답변받을 이메일",
    emailHint: "답변이 필요할 때만 입력해 주세요. 선택 사항입니다.",
    partnershipEmailHint: "협업·제휴 문의에는 답변받을 이메일이 필요합니다.",
    privacyNote: "이메일은 문의 답변에만 사용하며 사이트에 공개하지 않습니다.",
    sourceNote: "문의가 시작된 페이지 경로와 화면 크기도 함께 전달됩니다.",
    rateLimited: "한 시간에 문의를 3번까지 보낼 수 있습니다. 잠시 뒤 다시 시도해 주세요.",
    unavailableTitle: "지금은 우편함을 이용할 수 없습니다",
    successDetail: "운영자만 볼 수 있는 우편함에 도착했습니다.",
    sendAnother: "다른 문의 보내기",
    categories: {
      bug: { label: "오류·버그", description: "사이트 기능이 제대로 동작하지 않아요" },
      correction: { label: "정보·번역 수정", description: "게임 정보나 표기를 바로잡고 싶어요" },
      feedback: { label: "의견·아이디어", description: "사용 경험이나 새 기능을 제안하고 싶어요" },
      report: { label: "게시물 신고", description: "댓글이나 게시물을 운영자가 확인해야 해요" },
      partnership: { label: "협업·제휴", description: "협찬, 콘텐츠, 프로젝트를 함께하고 싶어요" },
      other: { label: "기타 문의", description: "어느 분류에도 딱 맞지 않아요" },
    },
  },
  en: {
    navLabel: "Contact",
    metadata: {
      title: "Contact · Tiny Mailbox",
      description: "Privately send bug reports, corrections, ideas, content reports, and partnership proposals to the operator.",
    },
    eyebrow: "Private contact",
    description: "Drop a note for the operator, from bug reports and ideas to partnership proposals.",
    privateNote: "Messages sent here are never published on the site.",
    messageLabel: "Message",
    messageHint: "Please include at least 10 characters and enough detail to investigate.",
    emailLabel: "Reply email",
    emailHint: "Only enter this if you would like a reply. Optional.",
    partnershipEmailHint: "A reply email is required for partnership inquiries.",
    privacyNote: "Your email is used only to reply and is never shown on the site.",
    sourceNote: "The source page path and viewport size are included automatically.",
    rateLimited: "You can send up to three inquiries per hour. Please try again later.",
    unavailableTitle: "The mailbox is unavailable right now",
    successDetail: "Your message arrived in the operator-only mailbox.",
    sendAnother: "Send another message",
    categories: {
      bug: { label: "Bug", description: "A site feature is not working correctly" },
      correction: { label: "Info correction", description: "Game information or translation needs a fix" },
      feedback: { label: "Feedback & ideas", description: "Share an experience or propose a feature" },
      report: { label: "Content report", description: "A post or comment needs operator review" },
      partnership: { label: "Partnership", description: "Propose sponsorship, content, or a project" },
      other: { label: "Other", description: "Something that does not fit the other categories" },
    },
  },
} as const satisfies Record<ServiceLocale, ContactMessages>;
