import Link from "next/link";
import { redirect } from "next/navigation";

import { AccessRequestCard } from "@/components/access-request-card";
import { AppShell } from "@/components/app-shell";
import { getAccessState } from "@/lib/auth";
import { formatDurationLabel } from "@/lib/display";
import { CLIENT_UPLOAD_CLIP_DURATION_SECONDS } from "@/lib/media-policy";
import { getDailyUsageSummary } from "@/lib/usage";

export default async function MyPage() {
  const access = await getAccessState();
  const uploadClipLabel = formatDurationLabel(CLIENT_UPLOAD_CLIP_DURATION_SECONDS);

  if (!access.session || !access.email) {
    redirect("/?notice=login-required");
  }

  const usageSummary = await getDailyUsageSummary(access.email);
  const statusText = {
    approved: "허용됨",
    pending: "승인 대기",
    not_requested: "미허용",
  }[access.membershipStatus];

  return (
    <AppShell
      access={access}
      currentPath="/mypage"
      description="현재 로그인한 계정 정보와 접근 상태, 오늘 사용량, 업로드 한도를 확인할 수 있는 계정 페이지입니다."
      title="마이페이지"
    >
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-4">
          <div className="rounded-[1.5rem] border border-border bg-white/92 p-6">
            <p className="text-xs font-semibold tracking-[0.16em] text-accent">계정 정보</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted">이름</p>
                <p className="text-lg font-semibold text-foreground">{access.name ?? "이름 미등록"}</p>
              </div>
              <div>
                <p className="text-sm text-muted">이메일</p>
                <p className="break-all text-lg font-semibold text-foreground">{access.email}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-border bg-white/92 p-6">
            <p className="text-xs font-semibold tracking-[0.16em] text-accent">이용 정보</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-sm text-muted">허용 상태</p>
                <p className="text-lg font-semibold text-foreground">{statusText}</p>
              </div>
              <div>
                <p className="text-sm text-muted">권한</p>
                <p className="text-lg font-semibold text-foreground">
                  {access.role === "manager"
                    ? "관리자"
                    : access.role === "member"
                      ? "사용 계정"
                      : "미지정"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted">자동 업로드</p>
                <p className="text-lg font-semibold text-foreground">
                  {uploadClipLabel} 클립
                </p>
              </div>
              <div>
                <p className="text-sm text-muted">오늘 사용량</p>
                <p className="text-lg font-semibold text-foreground">
                  {access.canUseStudio ? `${usageSummary.used} / ${usageSummary.limit}회` : "승인 후 이용 가능"}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted">
              허용 목록에 등록된 계정은 하루 {access.dailyGenerationLimit}회 더빙할 수 있고,
              {uploadClipLabel}를 넘는 원본은 브라우저에서 첫 {uploadClipLabel}만 자동 업로드합니다.
              {uploadClipLabel} 이하인데도 큰 파일은 모바일 업로드용으로 다시 압축하고, 서버
              파이프라인 자체는 최대 {formatDurationLabel(access.maxMediaDurationSeconds)} 길이까지 처리합니다.
            </p>
          </div>

          {access.canManageAllowlist ? (
            <div className="rounded-[1.5rem] border border-border bg-[#eef6ff] p-6">
              <p className="text-xs font-semibold tracking-[0.16em] text-[#2c6db2]">관리자 바로가기</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                허용 목록을 직접 관리할 수 있습니다
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                새 사용자를 허용 목록에 추가하고, 현재 등록된 계정과 대기 중인 요청을 함께 확인할 수 있습니다.
              </p>
              <Link
                href="/allowlist"
                className="mt-5 inline-flex items-center justify-center rounded-full border border-border bg-white px-5 py-3 text-sm font-semibold text-foreground transition hover:-translate-y-0.5 hover:bg-[#fff7f1]"
              >
                허용 목록 관리로 이동
              </Link>
            </div>
          ) : null}
        </div>

        <AccessRequestCard
          canManageAllowlist={access.canManageAllowlist}
          canUseStudio={access.canUseStudio}
          email={access.email}
          membershipStatus={access.membershipStatus}
        />
      </div>
    </AppShell>
  );
}
