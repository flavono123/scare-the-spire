import type { Preview } from "@storybook/nextjs-vite";
import "../src/app/globals.css";

if (typeof document !== "undefined") {
  document.documentElement.classList.add("dark", "patch-static-fonts");
  document.documentElement.lang = "ko";
  document.documentElement.setAttribute("data-service-locale", "ko");
  document.documentElement.setAttribute("data-game-locale", "kor");
  document.documentElement.style.colorScheme = "dark";
}

const preview: Preview = {
  parameters: {
    nextjs: {
      appDirectory: true,
    },
    layout: "padded",
    backgrounds: {
      options: {
        canvas: { name: "서비스 캔버스", value: "#111113" },
        black: { name: "거의 검정", value: "#07070d" },
        designDoc: { name: "DESIGN.md #0f0f13", value: "#0f0f13" },
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    options: {
      storySort: {
        order: ["소개", "토큰", "컴포넌트", "재고"],
      },
    },
    a11y: {
      test: "todo",
    },
  },
  initialGlobals: {
    backgrounds: { value: "canvas" },
  },
  decorators: [
    (Story) => (
      <div
        className="dark patch-static-fonts min-h-full bg-background font-service text-foreground antialiased"
        data-service-locale="ko"
        data-game-locale="kor"
      >
        <Story />
      </div>
    ),
  ],
};

export default preview;
