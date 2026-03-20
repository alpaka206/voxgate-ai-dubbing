import Link from "next/link";
import { redirect } from "next/navigation";

import { AccessRequestCard } from "@/components/access-request-card";
import { AppShell } from "@/components/app-shell";
import { PageNotice } from "@/components/page-notice";
import { getAccessState } from "@/lib/auth";
import { formatDurationLabel } from "@/lib/display";
import { CLIENT_UPLOAD_CLIP_DURATION_SECONDS } from "@/lib/media-policy";
import { getDailyUsageSummary } from "@/lib/usage";

type DashboardPageProps = {
  searchParams: Promise<{
    notice?: string;
  }>;
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const access = await getAccessState();
  const { notice } = await searchParams;
  const uploadClipLabel = formatDurationLabel(CLIENT_UPLOAD_CLIP_DURATION_SECONDS);

  if (!access.session || !access.email) {
    redirect("/?notice=login-required");
  }

  const usageSummary = await getDailyUsageSummary(access.email);
  const pageNotice =
    notice === "approval-required" ||
    notice === "login-required" ||
    notice === "manage-required"
      ? notice
      : undefined;

  return (
    <AppShell
      access={access}
      currentPath="/dashboard"
      description="현재 계정의 접근 상태와 오늘 사용량, 다음에 할 수 있는 작업을 한 번에 확인하는 시작 화면입니다."
      title="대시보드"
    >
      <div className="space-y-6">
        <PageNotice notice={pageNotice} />

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.5rem] border border-border bg-white/92 p-5">
            <p className="text-xs font-semibold tracking-[0.16em] text-accent">
              현재 상태
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {access.canUseStudio
                ? "바로 사용 가능"
                : access.membershipStatus === "pending"
                  ? "승인 대기 중"
                  : "허용 신청 필요"}
            </p>
            <p className="mt-3 text-sm leading-6 text-muted">
              {access.canUseStudio
                ? "현재 로그인한 이메일이 허용 목록에 등록되어 있어 더빙 스튜디오를 바로 사용할 수 있습니다."
                : access.membershipStatus === "pending"
                  ? "허용 신청이 접수된 상태입니다. 관리자 계정이 확인하면 바로 사용할 수 있도록 승인됩니다."
                  : "현재 로그인한 이메일은 아직 허용 목록에 없습니다. 아래에서 허용 신청을 남기면 관리자 계정이 확인할 수 있습니다."}
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-border bg-[#f4fbf7] p-5">
            <p className="text-xs font-semibold tracking-[0.16em] text-[#3c7d62]">
              오늘 사용량
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {access.canUseStudio
                ? `${usageSummary.used} / ${usageSummary.limit}회`
                : "승인 후 이용 가능"}
            </p>
            <p className="mt-3 text-sm leading-6 text-muted">
              {access.canUseStudio
                ? `오늘 남은 횟수는 ${usageSummary.remaining}회입니다.`
                : `승인된 계정은 하루 ${access.dailyGenerationLimit}회까지 더빙할 수 있습니다.`}
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-border bg-[#eef6ff] p-5">
            <p className="text-xs font-semibold tracking-[0.16em] text-[#2c6db2]">
              자동 업로드 정책
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {uploadClipLabel} 클립
            </p>
            <p className="mt-3 text-sm leading-6 text-muted">
              {uploadClipLabel}를 넘는 원본은 브라우저에서 첫 {uploadClipLabel}만 자동 업로드합니다.
              큰 파일은 모바일 업로드용으로 다시 압축하고, 서버 파이프라인 자체는 최대{" "}
              {formatDurationLabel(access.maxMediaDurationSeconds)}까지 처리합니다.
            </p>
          </div>
        </div>

        {access.canUseStudio ? (
          <div
            className={`grid gap-4 ${access.canManageAllowlist ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}
          >
            <Link
              href="/studio"
              className="rounded-[1.75rem] border border-border bg-white/92 p-6 shadow-[0_16px_35px_rgba(31,38,52,0.05)] transition hover:-translate-y-0.5 hover:bg-white"
            >
              <p className="text-xs font-semibold tracking-[0.16em] text-accent">
                바로 작업하기
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                스튜디오 열기
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                파일 업로드, 언어 선택, 목소리 선택까지 한 번에 진행한 뒤 더빙
                결과를 바로 확인할 수 있습니다.
              </p>
              <span className="mt-5 inline-flex rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(255,127,92,0.24)]">
                지금 시작하기
              </span>
            </Link>

            <Link
              href="/mypage"
              className="rounded-[1.75rem] border border-border bg-white/92 p-6 shadow-[0_16px_35px_rgba(31,38,52,0.05)] transition hover:-translate-y-0.5 hover:bg-white"
            >
              <p className="text-xs font-semibold tracking-[0.16em] text-accent">
                계정 확인
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                내 계정 보기
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                로그인 계정, 허용 상태, 오늘 사용량과 업로드 한도를 한곳에서
                확인할 수 있습니다.
              </p>
              <span className="mt-5 inline-flex rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground">
                마이페이지로 이동
              </span>
            </Link>

            {access.canManageAllowlist ? (
              <Link
                href="/allowlist"
                className="rounded-[1.75rem] border border-border bg-white/92 p-6 shadow-[0_16px_35px_rgba(31,38,52,0.05)] transition hover:-translate-y-0.5 hover:bg-white"
              >
                <p className="text-xs font-semibold tracking-[0.16em] text-accent">
                  관리자 기능
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                  허용 목록 관리
                </h2>
                <p className="mt-3 text-sm leading-6 text-muted">
                  새 사용자 요청을 확인하고 필요한 계정을 바로 사용 가능한 상태로
                  추가할 수 있습니다.
                </p>
                <span className="mt-5 inline-flex rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground">
                  허용 목록 열기
                </span>
              </Link>
            ) : null}
          </div>
        ) : (
          <AccessRequestCard
            canManageAllowlist={access.canManageAllowlist}
            canUseStudio={access.canUseStudio}
            email={access.email}
            membershipStatus={access.membershipStatus}
          />
        )}
      </div>
    </AppShell>
  );
}
