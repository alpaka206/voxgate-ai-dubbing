import { redirect } from "next/navigation";

import { SignInButton } from "@/components/auth-actions";
import { PageNotice } from "@/components/page-notice";
import { getAccessState } from "@/lib/auth";

type HomePageProps = {
  searchParams: Promise<{
    notice?: string;
  }>;
};

const serviceHighlights = [
  "오디오와 비디오 파일을 업로드해 실제 더빙 결과를 확인할 수 있어요.",
  "음성 추출, 전사, 번역, 타깃 언어 음성 생성까지 한 흐름으로 이어집니다.",
  "승인된 계정은 결과를 바로 재생하고 다운로드할 수 있어요.",
];

export default async function HomePage({ searchParams }: HomePageProps) {
  const access = await getAccessState();
  const { notice } = await searchParams;

  if (access.session) {
    redirect("/dashboard");
  }

  const pageNotice = notice === "login-required" ? "login-required" : undefined;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-12 sm:px-10">
      <section className="grid w-full gap-6 overflow-hidden rounded-[2rem] border border-border bg-surface p-8 shadow-[0_28px_70px_rgba(31,38,52,0.08)] backdrop-blur sm:p-10 lg:grid-cols-[1.08fr_0.92fr] lg:p-14">
        <div className="flex flex-col justify-between gap-10">
          <div className="space-y-6">
            <p className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              readvox
            </p>
            <div className="space-y-4">
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-4xl">
                파일을 올리면 원하는 언어로 더빙 결과를 바로 확인할 수 있어요
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted">
                readvox는 오디오와 비디오 파일을 업로드해 음성 추출, 전사, 번역,
                음성 합성까지 이어지는 AI 더빙 파이프라인을 빠르게 확인할 수
                있는 웹앱입니다.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <PageNotice notice={pageNotice} />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <SignInButton />
              <p className="text-sm leading-6 text-muted">
                Google 계정으로 로그인한 뒤 대시보드에서 승인 상태를 확인하고
                스튜디오로 이동할 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 rounded-[1.75rem] border border-border bg-surface-strong p-6">
          <div className="rounded-[1.5rem] bg-[linear-gradient(135deg,#fff4ec_0%,#ffffff_100%)] p-6">
            <p className="text-xs font-semibold tracking-[0.2em] text-accent">
              이용 흐름
            </p>
            <ol className="mt-4 space-y-3 text-sm leading-7 text-muted">
              <li>1. Google 계정으로 로그인합니다.</li>
              <li>2. 승인된 계정이면 스튜디오에서 파일을 업로드합니다.</li>
              <li>
                3. 타깃 언어를 고르고 더빙 결과를 재생하거나 다운로드합니다.
              </li>
            </ol>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {serviceHighlights.map((item) => (
              <div
                key={item}
                className="rounded-[1.25rem] border border-border bg-white/88 px-4 py-4 text-sm leading-6 text-muted"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
