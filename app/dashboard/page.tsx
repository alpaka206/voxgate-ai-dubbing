import Link from "next/link";
import { redirect } from "next/navigation";

import { AccessRequestCard } from "@/components/access-request-card";
import { AppShell } from "@/components/app-shell";
import { PageNotice } from "@/components/page-notice";
import { getAccessState } from "@/lib/auth";
import { formatDurationLabel } from "@/lib/display";
import { getRoleFeatures } from "@/lib/allowlist";
import { getDailyUsageSummary } from "@/lib/usage";

type DashboardPageProps = {
  searchParams: Promise<{
    notice?: string;
  }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const access = await getAccessState();
  const { notice } = await searchParams;

  if (!access.session || !access.email) {
    redirect("/?notice=login-required");
  }

  const features = getRoleFeatures(access.role);
  const usageSummary = await getDailyUsageSummary(access.email, access.role);
  const pageNotice =
    notice === "approval-required" || notice === "login-required" || notice === "signed-in"
      ? notice
      : undefined;

  return (
    <AppShell
      access={access}
      currentPath="/dashboard"
      description="계정 상태와 플랜 한도를 확인하고, 스튜디오 작업이나 플랜 신청으로 바로 이어갈 수 있는 시작 화면입니다."
      title="대시보드"
      usageSummary={usageSummary}
    >
      <div className="space-y-6">
        <PageNotice notice={pageNotice} />

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.5rem] border border-border bg-white/92 p-5">
            <p className="text-xs font-semibold tracking-[0.16em] text-accent">현재 상태</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {access.canUseStudio ? "바로 사용 가능" : access.membershipStatus === "pending" ? "승인 검토 중" : "승인 필요"}
            </p>
            <p className="mt-3 text-sm leading-6 text-muted">
              {access.canUseStudio
                ? "승인된 계정입니다. 스튜디오에서 오디오와 비디오 파일을 업로드해 더빙을 만들 수 있습니다."
                : access.membershipStatus === "pending"
                  ? "이용 신청이 접수되어 있습니다. 승인되면 스튜디오를 사용할 수 있습니다."
                  : "로그인은 완료됐지만 아직 허용 목록에 등록되지 않았습니다. 이용 신청 후 승인되면 서비스를 사용할 수 있습니다."}
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-border bg-[#f4fbf7] p-5">
            <p className="text-xs font-semibold tracking-[0.16em] text-[#3c7d62]">오늘 남은 횟수</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {access.canUseStudio ? `${usageSummary.remaining}회` : "승인 후 시작"}
            </p>
            <p className="mt-3 text-sm leading-6 text-muted">
              {access.canUseStudio
                ? `오늘 ${usageSummary.limit}회 중 ${usageSummary.used}회를 사용했습니다.`
                : "승인 이후에는 플랜에 따라 하루 더빙 횟수가 달라집니다."}
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-border bg-[#eef6ff] p-5">
            <p className="text-xs font-semibold tracking-[0.16em] text-[#2c6db2]">파일 길이 한도</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {formatDurationLabel(features.maxMediaDurationSeconds)}
            </p>
            <p className="mt-3 text-sm leading-6 text-muted">
              {access.canUseStudio
                ? "한 번에 업로드할 수 있는 최대 파일 길이입니다."
                : "승인 후에는 현재 플랜 기준으로 이 길이까지 업로드할 수 있습니다."}
            </p>
          </div>
        </div>

        {access.canUseStudio ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <Link
              href="/studio"
              className="rounded-[1.75rem] border border-border bg-white/92 p-6 shadow-[0_16px_35px_rgba(31,38,52,0.05)] transition hover:-translate-y-0.5 hover:bg-white"
            >
              <p className="text-xs font-semibold tracking-[0.16em] text-accent">바로 작업하기</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                스튜디오 열기
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                파일 업로드, 언어 선택, 목소리 선택까지 한 번에 진행한 뒤 더빙 결과를 바로 확인할 수 있습니다.
              </p>
              <span className="mt-5 inline-flex rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(255,127,92,0.24)]">
                지금 시작하기
              </span>
            </Link>

            <Link
              href="/plans"
              className="rounded-[1.75rem] border border-border bg-white/92 p-6 shadow-[0_16px_35px_rgba(31,38,52,0.05)] transition hover:-translate-y-0.5 hover:bg-white"
            >
              <p className="text-xs font-semibold tracking-[0.16em] text-accent">플랜 관리</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                더 긴 파일이 필요하다면
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                플랜이 올라가면 하루 사용 횟수와 업로드 가능한 파일 길이가 함께 늘어납니다.
              </p>
              <span className="mt-5 inline-flex rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground">
                플랜 비교하기
              </span>
            </Link>

            <Link
              href="/mypage"
              className="rounded-[1.75rem] border border-border bg-white/92 p-6 shadow-[0_16px_35px_rgba(31,38,52,0.05)] transition hover:-translate-y-0.5 hover:bg-white"
            >
              <p className="text-xs font-semibold tracking-[0.16em] text-accent">계정 확인</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                내 계정 보기
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                로그인 계정, 현재 플랜, 요청 상태와 오늘 사용량을 한곳에서 확인할 수 있습니다.
              </p>
              <span className="mt-5 inline-flex rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground">
                마이페이지로 이동
              </span>
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[1.75rem] border border-border bg-white/92 p-6 shadow-[0_16px_35px_rgba(31,38,52,0.05)]">
              <p className="text-xs font-semibold tracking-[0.16em] text-accent">이용 안내</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                승인되면 파일 기반 AI 더빙을 바로 사용할 수 있어요
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted">
                readvox는 오디오와 비디오 파일 업로드 후 음성 추출, 전사, 번역, 더빙 생성까지 이어지는 과제용 MVP입니다.
                승인 전에는 스튜디오 접근이 제한되며, 이용 신청이 반영되면 바로 사용할 수 있습니다.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.25rem] bg-[#fff8f2] px-4 py-4 text-sm leading-6 text-muted">
                  1. 파일 업로드
                </div>
                <div className="rounded-[1.25rem] bg-[#f6fbf8] px-4 py-4 text-sm leading-6 text-muted">
                  2. 전사 · 번역 · 더빙
                </div>
                <div className="rounded-[1.25rem] bg-[#f4f8ff] px-4 py-4 text-sm leading-6 text-muted">
                  3. 미리듣기 · 다운로드
                </div>
              </div>
            </div>

            <AccessRequestCard
              canUseStudio={access.canUseStudio}
              currentPlan={access.role}
              currentPlanLabel={features.label}
              membershipStatus={access.membershipStatus}
              requestedPlan={access.requestedPlan}
              requestedPlanLabel={access.requestedPlan ? getRoleFeatures(access.requestedPlan).label : null}
            />
          </div>
        )}

        {access.canUseStudio ? (
          <AccessRequestCard
            canUseStudio={access.canUseStudio}
            currentPlan={access.role}
            currentPlanLabel={features.label}
            membershipStatus={access.membershipStatus}
            requestedPlan={access.requestedPlan}
            requestedPlanLabel={access.requestedPlan ? getRoleFeatures(access.requestedPlan).label : null}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
