import Image from "next/image";
import { notFound } from "next/navigation";
import { DonatedRunsSection } from "@/components/history-course/donated-runs-section";
import { RunUploadZone } from "@/components/history-course/run-upload-zone";
import { UploadTutorial } from "@/components/history-course/upload-tutorial";
import { HISTORY_COURSE_ENABLED } from "@/lib/feature-flags";

export const metadata = {
  title: "역사 강의서",
  description:
    "슬레이 더 스파이어 2 의 시드 기반 도전 이력. 막 맵 위에 진행 노드를 다시 그려 한 판을 처음부터 끝까지 따라갑니다.",
};

export default function HistoryCourseIndexPage() {
  if (!HISTORY_COURSE_ENABLED) notFound();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="flex items-center gap-4">
        <Image
          src="/images/sts2/relics/history_course.webp"
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 object-contain drop-shadow"
        />
        <div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-50">
            역사 강의서
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">
            한 판의 시드와 진행 기록만으로 막 맵을 다시 그려 처음부터 끝까지
            따라갑니다. STS2 폴더를 올려 본인의 런을 찾아보세요.
          </p>
        </div>
      </header>

      <div className="mt-8 space-y-4">
        <RunUploadZone />
        <UploadTutorial />
      </div>

      <DonatedRunsSection />
    </div>
  );
}
